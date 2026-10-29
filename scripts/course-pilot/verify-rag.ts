import { verifyAssistantHttp } from './verify-rag-http';
import * as assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { EntityManager } from 'typeorm';
import { CourseAssistantService } from '../../src/course-assistant/course-assistant.service';
import { RagStore } from '../../src/course-assistant/rag-store';
import { RESERVE_RAG } from '../../src/course-assistant/rag-budget';
import { RedisService } from '../../src/redis';
import { AcademicAccessService } from '../../src/academic-access/academic-access.service';
import { CourseDocumentsService } from '../../src/course-documents/course-documents.service';
import { CourseDocumentVersion } from '../../src/course-documents/entities/course-document-version.entity';
import { DocumentVersionStatus } from '../../src/course-documents/document.enums';
import { User } from '../../src/user/entities/user.entity';
import { Course } from '../../src/course/entities/course.entity';
import { ForbiddenException, ConflictException } from '@nestjs/common';

export async function verifyRag(
  manager: EntityManager,
  documents: CourseDocumentsService,
  access: AcademicAccessService,
  teacher: User,
  student: User,
  courseId: string,
  guideId: string,
  scheduleId: string
) {
  const db = { query: manager.query.bind(manager), transaction: async (fn) => fn(manager) };
  const store = new RagStore(db as never);
  let calls = 0,
    withdraw = false;
  const vector = Array(768).fill(0);
  vector[0] = 1;
  const provider = {
    enabled: true,
    assertAvailable() {},
    async embed(texts: string[]) {
      calls++;
      return texts.map(() => vector);
    },
    async answer() {
      calls++;
      if (withdraw)
        await documents.archive(
          courseId,
          (await manager.getRepository(CourseDocumentVersion).findOneByOrFail({ id: guideId }))
            .documentId,
          teacher
        );
      return { answer: 'Evidencia de prueba', citationIds: ['s1'] };
    },
  };
  const service = new CourseAssistantService(
    store,
    access,
    documents,
    { reserve: async () => async () => {} } as never,
    provider as never
  );
  for (const id of [guideId, scheduleId])
    await manager.getRepository(CourseDocumentVersion).update(id, {
      pages: [{ page: 2, text: 'Contenido verificable '.repeat(200) }],
      status: DocumentVersionStatus.PUBLISHED,
    });
  assert.equal((await service.ask(courseId, student.id, 'Consulta de prueba')).state, 'NOT_READY');
  assert.equal(calls, 0);
  for (const id of [guideId, scheduleId])
    assert.equal((await service.prepare(courseId, teacher.id, id)).complete, true);
  const paid = calls;
  await service.prepare(courseId, teacher.id, guideId);
  assert.equal(calls, paid, 'Complete indexing must be idempotent');
  const answer = await service.ask(courseId, student.id, 'Consulta de prueba');
  assert.equal(answer.state, 'ANSWERED');
  assert.equal(answer.citations[0].page, 2);
  if(process.env.RUN_HTTP_INTEGRATION==='true') await verifyAssistantHttp(manager,service,student,courseId);
  assert.equal(
    (await store.retrieve(randomUUID(), vector)).length,
    0,
    'Foreign course retrieval must be empty'
  );
  // Each guard is real and queries the current transaction state.
  const beforeDenial = calls;
  await manager.getRepository(User).update(student.id, { isActive: false });
  await assert.rejects(service.ask(courseId, student.id, 'Consulta de prueba'), ForbiddenException);
  await manager.getRepository(User).update(student.id, { isActive: true });
  await manager.createQueryBuilder().relation(Course, 'users').of(courseId).remove(student.id);
  await assert.rejects(service.ask(courseId, student.id, 'Consulta de prueba'), ForbiddenException);
  await manager.createQueryBuilder().relation(Course, 'users').of(courseId).add(student.id);
  assert.equal(calls, beforeDenial, 'Revoked access must not call provider');
  await assert.rejects(service.prepare(courseId, student.id, guideId), ForbiddenException);
  withdraw = true;
  await assert.rejects(service.ask(courseId, student.id, 'Consulta de prueba'), ConflictException);
  withdraw = false;
  assert.equal(
    (
      await manager.query('SELECT count(*)::int AS n FROM course_rag_chunks WHERE version_id=$1', [
        guideId,
      ])
    )[0].n,
    0,
    'Withdrawal must delete embeddings'
  );
  assert.ok((await store.retrieve(courseId, vector)).every((h) => h.versionId !== guideId));
  const guide = await manager.getRepository(CourseDocumentVersion).findOneByOrFail({ id: guideId });
  await documents.publish(courseId, guide.documentId, guideId, teacher);
  assert.equal(await store.ready(courseId), false, 'Reopening needs explicit preparation');
  await service.prepare(courseId, teacher.id, guideId);
  const [snapshot] = await store.sources(courseId);
  await manager
    .getRepository(CourseDocumentVersion)
    .update(snapshot.id, { status: DocumentVersionStatus.ARCHIVED });
  await assert.rejects(
    store.saveBatch(courseId, snapshot, 1, [{ ordinal: 0, page: 1, text: 'stale' }], [vector]),
    ConflictException
  );
  const [remainingIndex] = await manager.query(
    'SELECT version_id FROM course_rag_indexes WHERE version_id=ANY($1::uuid[]) LIMIT 1',
    [[guideId, scheduleId]]
  );
  assert.ok(remainingIndex);
  await manager
    .getRepository(CourseDocumentVersion)
    .update(remainingIndex.version_id, { extractedText: 'Texto corregido' });
  assert.equal(
    (
      await manager.query('SELECT count(*)::int AS n FROM course_rag_chunks WHERE version_id=$1', [
        remainingIndex.version_id,
      ])
    )[0].n,
    0,
    'Text edits must invalidate embeddings, including DOCX with pages=[]'
  );
  console.log(
    'RAG PostgreSQL: complete-only retrieval, course isolation, idempotency, page citations, student revocation, teacher-only indexing, concurrent withdrawal, trigger cleanup and reopening passed. Model responses simulated; transaction rolls back.'
  );
  if (process.env.RUN_HTTP_INTEGRATION === 'true') {
    const redis = new RedisService(new ConfigService({ REDIS_URL: 'redis://127.0.0.1:6379' }));
    const prefix = `rag-test:${randomUUID()}`,
      keys = [prefix + ':lock', prefix + ':actor', prefix + ':global'];
    try {
      await redis.onModuleInit();
      const results = await Promise.all(
        Array.from({ length: 8 }, () =>
          redis.client.eval(RESERVE_RAG, { keys, arguments: [randomUUID(), '1', '1', '10'] })
        )
      );
      assert.equal(results.filter((x) => x === 1).length, 1);
      assert.equal(await redis.client.get(keys[1]), '1');
      await redis.client.del(keys[0]);
      assert.equal(
        await redis.client.eval(RESERVE_RAG, { keys, arguments: [randomUUID(), '1', '1', '10'] }),
        -2
      );
      assert.equal(await redis.client.get(keys[2]), '1');
      console.log(
        'RAG Redis: eight concurrent reservations admit exactly one; daily quota denies without partial increments.'
      );
    } finally {
      if (redis.client.isOpen) await redis.client.del(keys);
      await redis.onApplicationShutdown();
    }
  }
  return service;
}
