import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AcademicAccessService } from '../academic-access/academic-access.service';
import { CourseDocumentsService } from '../course-documents/course-documents.service';
import { sourceChunks, validateAnswer } from './rag-content';
import { RagBudget } from './rag-budget';
import { RagProvider } from './rag-provider';
import { RagStore } from './rag-store';
const noEvidence = () => ({
  state: 'NO_EVIDENCE' as const,
  answer:
    'No encontré evidencia suficiente en los documentos publicados. Consulta al docente para confirmar.',
  citations: [],
});
@Injectable()
export class CourseAssistantService {
  constructor(
    private readonly store: RagStore,
    private readonly access: AcademicAccessService,
    private readonly library: CourseDocumentsService,
    private readonly budget: RagBudget,
    private readonly provider: RagProvider
  ) {}
  async status(courseId: string, actorId: string) {
    await this.library.authorize(courseId, actorId, true);
    const sources = await this.store.sources(courseId);
    const items = await Promise.all(
      sources.map(async (source) => {
        const metadata = {
          versionId: source.id,
          documentId: source.documentId,
          title: source.title,
          version: source.version,
        };
        try {
          const chunks = sourceChunks(source);
          if (!chunks.length)
            throw new BadRequestException(
              'Esta versión no tiene texto verificable. Carga una versión legible.'
            );
          const p = await this.store.progress(source, chunks.length);
          return {
            ...metadata,
            done: p.done,
            total: chunks.length,
            complete: p.done === chunks.length,
          };
        } catch (error) {
          if (!(error instanceof BadRequestException)) throw error;
          return { ...metadata, done: 0, total: 0, complete: false, error: error.message };
        }
      })
    );
    return { enabled: this.provider.enabled, items };
  }
  async prepare(courseId: string, actorId: string, versionId: string) {
    await this.library.authorize(courseId, actorId, true);
    this.provider.assertAvailable();
    const source = (await this.store.sources(courseId)).find((s) => s.id === versionId);
    if (!source) throw new NotFoundException('La versión no está publicada en este curso.');
    const chunks = sourceChunks(source);
    if (!chunks.length) throw new BadRequestException('Esta versión no tiene texto verificable.');
    const progress = await this.store.progress(source, chunks.length);
    const batch = chunks.filter((c) => !progress.ordinals.includes(c.ordinal)).slice(0, 16);
    if (!batch.length) return { complete: true, done: chunks.length, total: chunks.length };
    const release = await this.budget.reserve(actorId, 'index', batch.length);
    try {
      await this.library.authorize(courseId, actorId, true);
      const vectors = await this.provider.embed(batch.map((c) => c.text));
      await this.library.authorize(courseId, actorId, true);
      await this.store.saveBatch(courseId, source, chunks.length, batch, vectors);
      const done = (await this.store.progress(source, chunks.length)).done;
      return { complete: done === chunks.length, done, total: chunks.length };
    } finally {
      await release();
    }
  }
  async ask(courseId: string, actorId: string, question: string) {
    await this.access.requireStudentCourse(actorId, courseId);
    if (typeof question !== 'string' || question.trim().length < 3 || question.length > 1000)
      throw new BadRequestException('Escribe una pregunta de 3 a 1000 caracteres.');
    this.provider.assertAvailable();
    if (!(await this.store.ready(courseId)))
      return {
        state: 'NOT_READY' as const,
        answer: 'El docente debe preparar las fuentes publicadas antes de usar el asistente.',
        citations: [],
      };
    const release = await this.budget.reserve(actorId, 'question', 1);
    try {
      await this.access.requireStudentCourse(actorId, courseId);
      const [embedding] = await this.provider.embed([question.trim()], true);
      await this.access.requireStudentCourse(actorId, courseId);
      const hits = (await this.store.retrieve(courseId, embedding, question.trim())).filter(
        (h) => Number.isFinite(h.similarity) && h.similarity >= 0.35
      );
      if (!hits.length) return noEvidence();
      await this.access.requireStudentCourse(actorId, courseId);
      if (!(await this.store.stillPublished(courseId, hits)))
        throw new ConflictException('Las fuentes cambiaron. Vuelve a consultar.');
      const raw = await this.provider.answer(
        question.trim(),
        hits.map((h, i) => ({ id: `s${i + 1}`, title: h.title, page: h.page, text: h.text }))
      );
      await this.access.requireStudentCourse(actorId, courseId);
      if (!(await this.store.stillPublished(courseId, hits)))
        throw new ConflictException('Las fuentes cambiaron. Vuelve a consultar.');
      const validated = validateAnswer(
        raw,
        hits.map((_, i) => `s${i + 1}`)
      );
      if (!validated) return noEvidence();
      const citations = hits
        .map((h, i) => ({
          id: `s${i + 1}`,
          title: h.title,
          documentId: h.documentId,
          versionId: h.versionId,
          version: h.version,
          format: h.format,
          page: h.page,
        }))
        .filter((c) => validated.citationIds.includes(c.id));
      return { state: 'ANSWERED' as const, answer: validated.answer, citations };
    } finally {
      await release();
    }
  }
}
