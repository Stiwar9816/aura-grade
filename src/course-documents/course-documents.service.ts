import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, FindOptionsSelect } from 'typeorm';
import { isUUID } from 'class-validator';
import { AcademicAccessService } from '../academic-access/academic-access.service';
import { hasAcademicAccess } from '../academic-access/academic-access.policy';
import { User } from '../user/entities/user.entity';
import { Course } from '../course/entities/course.entity';
import { UserRoles } from '../auth/enums';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CourseDocument } from './entities/course-document.entity';
import { CourseDocumentVersion } from './entities/course-document-version.entity';
import { DocumentExtractionState, DocumentVersionStatus } from './document.enums';
import { CreateCourseDocumentDto, ReviewDocumentVersionDto } from './dto/document.dto';
import { DocumentExtractionService, DocumentUpload } from './document-extraction.service';

const VERSION_METADATA: FindOptionsSelect<CourseDocumentVersion> = {
  id: true,
  documentId: true,
  version: true,
  status: true,
  originalName: true,
  format: true,
  sizeBytes: true,
  contentHash: true,
  extractionState: true,
  reviewedAt: true,
  publishedAt: true,
  archivedAt: true,
  createdAt: true,
};

@Injectable()
export class CourseDocumentsService {
  private readonly logger = new Logger(CourseDocumentsService.name);
  constructor(
    private readonly db: DataSource,
    private readonly storage: CloudinaryService,
    private readonly extraction: DocumentExtractionService,
    private readonly access: AcademicAccessService
  ) {}

  async create(courseId: string, actor: User, input: CreateCourseDocumentDto) {
    await this.authorize(courseId, actor.id, true);
    try {
      const repo = this.db.getRepository(CourseDocument);
      const document = await repo.save(
        repo.create({ courseId, title: input.title.trim(), kind: input.kind })
      );
      return this.documentView(document);
    } catch (error) {
      if (error?.code === '23505')
        throw new ConflictException(
          'El curso ya tiene un documento de este tipo; carga una nueva versión.'
        );
      throw error;
    }
  }

  async list(courseId: string, actor: User, page = 1, limit = 20) {
    const role = await this.authorize(courseId, actor.id, false);
    const [items, total] = await this.db.getRepository(CourseDocument).findAndCount({
      where:
        role === UserRoles.Estudiante
          ? { courseId, versions: { status: DocumentVersionStatus.PUBLISHED } }
          : { courseId },
      order: { createdAt: 'DESC', id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items: items.map((d) => this.documentView(d)), total, page, limit };
  }

  async listVersions(courseId: string, documentId: string, actor: User, page = 1, limit = 20) {
    const role = await this.authorize(courseId, actor.id, false);
    await this.document(courseId, documentId);
    const [items, total] = await this.db.getRepository(CourseDocumentVersion).findAndCount({
      where: {
        documentId,
        ...(role === UserRoles.Estudiante ? { status: DocumentVersionStatus.PUBLISHED } : {}),
      },
      select: VERSION_METADATA,
      order: { version: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items: items.map((v) => this.versionView(v)), total, page, limit };
  }

  async upload(
    courseId: string,
    documentId: string,
    actor: User,
    file: DocumentUpload,
    key: string
  ) {
    await this.authorize(courseId, actor.id, true);
    await this.document(courseId, documentId);
    if (!isUUID(key ?? '')) throw new BadRequestException('Idempotency-Key debe ser un UUID.');
    const extracted = await this.extraction.extract(file);
    const prior = await this.db
      .getRepository(CourseDocumentVersion)
      .findOne({ where: { documentId, idempotencyKey: key } });
    if (prior) return this.repeatedUpload(prior, extracted.contentHash);
    const stored = await this.storage.uploadCourseDocument(file.buffer, extracted.format);
    let persisted = false;
    try {
      const result = await this.db.transaction(async (manager) => {
        await this.authorize(courseId, actor.id, true, manager);
        const document = await this.document(courseId, documentId, manager, true);
        const repo = manager.getRepository(CourseDocumentVersion);
        const existing = await repo.findOne({ where: { documentId, idempotencyKey: key } });
        if (existing)
          return { reused: true, view: this.repeatedUpload(existing, extracted.contentHash) };
        const version = await repo.save(
          repo.create({
            documentId,
            version: document.nextVersion,
            status: DocumentVersionStatus.DRAFT,
            originalName: file.originalname.replace(/[\\/\p{Cc}]/gu, '_').slice(0, 255),
            format: extracted.format,
            sizeBytes: file.buffer.length,
            storagePublicId: stored.publicId,
            contentHash: extracted.contentHash,
            idempotencyKey: key,
            extractionState: extracted.state as DocumentExtractionState,
            extractedText: extracted.text,
            pages: extracted.pages,
            uploadedById: actor.id,
            reviewedAt: null,
            reviewedById: null,
            publishedAt: null,
            archivedAt: null,
          })
        );
        document.nextVersion += 1;
        await manager.getRepository(CourseDocument).save(document);
        return { reused: false, view: this.versionView(version) };
      });
      persisted = !result.reused;
      return result.view;
    } finally {
      if (!persisted) {
        try {
          await this.storage.deleteCourseDocument(stored.publicId);
        } catch {
          this.logger.error(`No se pudo limpiar el archivo huérfano ${stored.publicId}.`);
        }
      }
    }
  }

  async detail(courseId: string, documentId: string, versionId: string, actor: User) {
    const version = await this.readVersion(courseId, documentId, versionId, actor);
    const document = await this.document(courseId, documentId);
    return {
      ...this.versionView(version),
      canReopen:
        version.status === DocumentVersionStatus.ARCHIVED &&
        version.version === document.lastPublishedVersion &&
        !!version.reviewedAt &&
        !!version.reviewedById &&
        version.extractionState === DocumentExtractionState.READY &&
        !!version.extractedText.trim(),
      extractedText: version.extractedText,
      pages: version.pages,
    };
  }

  async download(
    courseId: string,
    documentId: string,
    versionId: string,
    actor: User
  ): Promise<string> {
    const version = await this.readVersion(courseId, documentId, versionId, actor);
    return this.storage.courseDocumentDownloadUrl(version.storagePublicId);
  }

  async review(
    courseId: string,
    documentId: string,
    versionId: string,
    actor: User,
    input: ReviewDocumentVersionDto
  ) {
    return this.db.transaction(async (manager) => {
      await this.authorize(courseId, actor.id, true, manager);
      await this.document(courseId, documentId, manager, true);
      const version = await this.version(documentId, versionId, manager);
      if (version.status !== DocumentVersionStatus.DRAFT)
        throw new ConflictException('Solo se revisan versiones en borrador.');
      if (
        version.extractionState !== DocumentExtractionState.READY ||
        !version.extractedText.trim()
      )
        throw new BadRequestException('Sube una versión legible con texto antes de revisarla.');
      if (input.confirmed !== true)
        throw new BadRequestException('Confirma la revisión del documento.');
      if (input.contentHash !== version.contentHash)
        throw new ConflictException('El documento no coincide con el archivo revisado.');
      version.reviewedById = actor.id;
      version.reviewedAt = new Date();
      return this.versionView(await manager.getRepository(CourseDocumentVersion).save(version));
    });
  }

  async publish(courseId: string, documentId: string, versionId: string, actor: User) {
    return this.db.transaction(async (manager) => {
      await this.authorize(courseId, actor.id, true, manager);
      const document = await this.document(courseId, documentId, manager, true);
      const version = await this.version(documentId, versionId, manager);
      if (version.status === DocumentVersionStatus.PUBLISHED) return this.versionView(version);
      const reopening =
        version.status === DocumentVersionStatus.ARCHIVED &&
        version.version === document.lastPublishedVersion;
      if (
        !reopening &&
        (version.status !== DocumentVersionStatus.DRAFT ||
          version.version <= document.lastPublishedVersion)
      )
        throw new ConflictException('Sube una nueva versión; esta versión ya no puede publicarse.');
      if (
        !version.reviewedAt ||
        !version.reviewedById ||
        version.extractionState !== DocumentExtractionState.READY ||
        !version.extractedText.trim()
      )
        throw new BadRequestException(
          'Revisa y confirma el texto del documento antes de publicarlo.'
        );
      const now = new Date();
      const repo = manager.getRepository(CourseDocumentVersion);
      await repo.update(
        { documentId, status: DocumentVersionStatus.PUBLISHED },
        { status: DocumentVersionStatus.ARCHIVED, archivedAt: now }
      );
      version.status = DocumentVersionStatus.PUBLISHED;
      version.publishedAt = now;
      version.archivedAt = null;
      document.lastPublishedVersion = version.version;
      await manager.getRepository(CourseDocument).save(document);
      return this.versionView(await repo.save(version));
    });
  }

  async archive(courseId: string, documentId: string, actor: User) {
    return this.db.transaction(async (manager) => {
      await this.authorize(courseId, actor.id, true, manager);
      await this.document(courseId, documentId, manager, true);
      await manager
        .getRepository(CourseDocumentVersion)
        .update(
          { documentId, status: DocumentVersionStatus.PUBLISHED },
          { status: DocumentVersionStatus.ARCHIVED, archivedAt: new Date() }
        );
      return { archived: true };
    });
  }

  async authorize(
    courseId: string,
    actorId: string,
    write: boolean,
    manager: Pick<EntityManager, 'getRepository'> = this.db
  ): Promise<UserRoles> {
    if (!actorId || !courseId)
      throw new ForbiddenException('No tienes acceso a los documentos del curso.');
    const user = await manager
      .getRepository(User)
      .findOne({ where: { id: actorId }, relations: ['institution'] });
    if (!hasAcademicAccess(user))
      throw new ForbiddenException('Tu acceso académico no está habilitado.');
    if (!write && user.role === UserRoles.Estudiante) {
      await this.access.requireStudentCourse(user.id, courseId);
      return user.role;
    }
    if (user.role !== UserRoles.Docente)
      throw new ForbiddenException('Solo el docente del curso administra estos documentos.');
    const course = await manager
      .getRepository(Course)
      .findOne({ where: { id: courseId }, relations: ['user'] });
    if (!course || course.user.id !== user.id || course.user.institutionId !== user.institutionId)
      throw new ForbiddenException('No tienes acceso a los documentos del curso.');
    return user.role;
  }

  private async document(
    courseId: string,
    id: string,
    manager: Pick<EntityManager, 'getRepository'> = this.db,
    lock = false
  ): Promise<CourseDocument> {
    const document = await manager.getRepository(CourseDocument).findOne({
      where: { id, courseId },
      ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    if (!document) throw new NotFoundException('Documento no disponible.');
    return document;
  }

  private async version(
    documentId: string,
    id: string,
    manager: Pick<EntityManager, 'getRepository'> = this.db
  ): Promise<CourseDocumentVersion> {
    const version = await manager
      .getRepository(CourseDocumentVersion)
      .findOne({ where: { id, documentId } });
    if (!version) throw new NotFoundException('Versión no disponible.');
    return version;
  }

  private async readVersion(courseId: string, documentId: string, versionId: string, actor: User) {
    const role = await this.authorize(courseId, actor.id, false);
    await this.document(courseId, documentId);
    const version = await this.version(documentId, versionId);
    if (role === UserRoles.Estudiante && version.status !== DocumentVersionStatus.PUBLISHED)
      throw new NotFoundException('Versión no disponible.');
    return version;
  }

  private repeatedUpload(version: CourseDocumentVersion, hash: string) {
    if (version.contentHash !== hash)
      throw new ConflictException('La clave de subida ya pertenece a otro archivo.');
    return this.versionView(version);
  }

  private documentView(d: CourseDocument) {
    return { id: d.id, courseId: d.courseId, title: d.title, kind: d.kind, createdAt: d.createdAt };
  }

  private versionView(v: CourseDocumentVersion) {
    return {
      id: v.id,
      documentId: v.documentId,
      version: v.version,
      status: v.status,
      originalName: v.originalName,
      format: v.format,
      sizeBytes: v.sizeBytes,
      contentHash: v.contentHash,
      extractionState: v.extractionState,
      reviewedAt: v.reviewedAt,
      publishedAt: v.publishedAt,
      archivedAt: v.archivedAt,
      createdAt: v.createdAt,
    };
  }
}
