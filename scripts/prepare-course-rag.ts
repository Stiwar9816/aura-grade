/** Explicit local pilot preparation. --apply persists only derived indexes; --query rolls back a temporary student. */
import 'reflect-metadata';
import * as assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { AppDataSource } from '../src/config/datasource.config';
import { CourseAssistantService } from '../src/course-assistant/course-assistant.service';
import { RagStore } from '../src/course-assistant/rag-store';
import { RagBudget } from '../src/course-assistant/rag-budget';
import { RagProvider } from '../src/course-assistant/rag-provider';
import { AcademicAccessService } from '../src/academic-access/academic-access.service';
import { CourseDocumentsService } from '../src/course-documents/course-documents.service';
import { RedisService } from '../src/redis';
import { Course } from '../src/course/entities/course.entity';
import { User } from '../src/user/entities/user.entity';
import { UserRoles, DocumentType } from '../src/auth/enums';
import { InstitutionApprovalStatus } from '../src/institution/enums/institution-approval-status.enum';
const COURSE = 'b86e6a66-12b6-4e7f-a5c3-d6564ff7d1cc';
async function main() {
  assert.equal(process.env.STATE, 'dev');
  assert.ok(['127.0.0.1', 'localhost'].includes(process.env.DB_HOST!));
  const db = await AppDataSource.initialize();
  const config = new ConfigService({ RAG_ENABLED: 'true', REDIS_URL: 'redis://127.0.0.1:6379' });
  const redis = new RedisService(config);
  const provider = new RagProvider(config),
    budget = new RagBudget(redis, config);
  const access = new AcademicAccessService(db.getRepository(User), db.getRepository(Course));
  const library = new CourseDocumentsService(db, {} as never, {} as never, access);
  const service = new CourseAssistantService(new RagStore(db), access, library, budget, provider);
  try {
    const course = await db
      .getRepository(Course)
      .findOneOrFail({ where: { id: COURSE }, relations: ['user'] });
    const status = await service.status(COURSE, course.user.id);
    console.log(JSON.stringify(status));
    if (!process.argv.includes('--apply')) return;
    await redis.onModuleInit();
    for (const source of status.items) {
      for (let i = 0; i < 32; i++) {
        const result = await service.prepare(COURSE, course.user.id, source.versionId);
        console.log(JSON.stringify({ title: source.title, ...result }));
        if (result.complete) break;
        if (i === 31) throw new Error('Batch limit reached');
      }
    }
    assert.ok((await service.status(COURSE, course.user.id)).items.every((i) => i.complete));
    if (process.argv.includes('--query')) {
      const runner = db.createQueryRunner();
      await runner.connect();
      await runner.startTransaction();
      try {
        const m = runner.manager,
          salt = Date.now() % 10000000000;
        const student = await m
          .getRepository(User)
          .save({
            name: 'Prueba',
            last_name: 'RAG',
            document_type: Object.values(DocumentType)[0],
            document_num: salt,
            phone: salt,
            email: `rag-${randomUUID()}@example.invalid`,
            password: 'unusable',
            role: UserRoles.Estudiante,
            isActive: true,
            approvalStatus: InstitutionApprovalStatus.APPROVED,
            institutionId: course.user.institutionId,
          });
        await m.createQueryBuilder().relation(Course, 'users').of(COURSE).add(student.id);
        const facade = {
          query: m.query.bind(m),
          getRepository: m.getRepository.bind(m),
          transaction: async (fn) => fn(m),
        };
        const studentAccess = new AcademicAccessService(
          m.getRepository(User),
          m.getRepository(Course)
        );
        const queryStore = new RagStore(facade as never);
        if (process.argv.includes('--diagnose')) {
          const retrieve = queryStore.retrieve.bind(queryStore);
          queryStore.retrieve = async (...args) => {
            const hits = await retrieve(...args);
            console.log(
              JSON.stringify({
                retrieval: hits.map((h) => ({
                  title: h.title,
                  page: h.page,
                  similarity: h.similarity,
                  text: h.text,
                })),
              })
            );
            return hits;
          };
          const generate = provider.answer.bind(provider);
          provider.answer = async (...args) => {
            const result = await generate(...args);
            console.log(JSON.stringify({ generated: result }));
            return result;
          };
        }
        const live = new CourseAssistantService(
          queryStore,
          studentAccess,
          library,
          budget,
          provider
        );
        const answer = await live.ask(
          COURSE,
          student.id,
          '¿Qué criterios se evalúan en la actividad 3, examen parcial?'
        );
        console.log(JSON.stringify({ liveGemini: true, ...answer }));
        assert.equal(answer.state, 'ANSWERED');
        assert.ok(answer.citations.length > 0);
      } finally {
        await runner.rollbackTransaction();
        await runner.release();
      }
    }
  } finally {
    await redis.onApplicationShutdown();
    await db.destroy();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
