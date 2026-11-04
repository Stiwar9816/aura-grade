import * as assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { User } from '../../src/user/entities/user.entity';
import { Course } from '../../src/course/entities/course.entity';
import { SessionService } from '../../src/auth/session';
import { RedisService } from '../../src/redis';
import { BffAuthGuard } from '../../src/common/guards/bff-auth.guard';
import { CourseAssistantService } from '../../src/course-assistant/course-assistant.service';
import { CourseAssistantController } from '../../src/course-assistant/course-assistant.controller';

/** Real HTTP, PostgreSQL and Redis; synthetic session issuance, no OTP/email. */
export async function verifyAssistantHttp(
  manager: EntityManager,
  assistant: CourseAssistantService,
  student: User,
  courseId: string
) {
  const secret = randomUUID();
  const config = new ConfigService({
    REDIS_URL: 'redis://127.0.0.1:6379',
    BFF_SHARED_SECRET: secret,
    STATE: 'prod',
  });
  const redis = new RedisService(config);
  const sessions = new SessionService(redis, manager.getRepository(User), config, {
    increment() {},
    observeValidation() {},
  } as never);
  let app;
  try {
    await redis.onModuleInit();
    const { sessionToken } = await sessions.create(student, false, 'mfa');
    const module = await Test.createTestingModule({
      controllers: [CourseAssistantController],
      providers: [
        { provide: CourseAssistantService, useValue: assistant },
        { provide: SessionService, useValue: sessions },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    app.useGlobalGuards(new BffAuthGuard(config));
    await app.listen(0, '127.0.0.1');
    const base = `${await app.getUrl()}/api/courses/${courseId}/assistant`;
    const headers: Record<string, string> = {
      authorization: `Bearer ${sessionToken}`,
      'x-bff-secret': secret,
      'content-type': 'application/json',
    };
    const post = (body: unknown = { question: 'Consulta de prueba' }, override = headers) =>
      fetch(base + '/questions', { method: 'POST', headers: override, body: JSON.stringify(body) });
    const response = await post();
    assert.equal(response.status, 201);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal((await response.json()).state, 'ANSWERED');
    assert.equal((await post({ question: 'Consulta', studentId: student.id })).status, 400);
    assert.equal((await post({ question: 'x'.repeat(1001) })).status, 400);
    assert.equal(
      (await fetch(base + '/sources', { headers })).status,
      403,
      'Student cannot manage index'
    );
    assert.equal(
      (await post({ question: 'Consulta' }, { ...headers, 'x-bff-secret': '' })).status,
      403
    );
    await manager.createQueryBuilder().relation(Course, 'users').of(courseId).remove(student.id);
    assert.equal((await post()).status, 403);
    await manager.createQueryBuilder().relation(Course, 'users').of(courseId).add(student.id);
    await manager.getRepository(User).update(student.id, { isActive: false });
    assert.equal((await post()).status, 401);
    await manager.getRepository(User).update(student.id, { isActive: true });
    console.log(
      'RAG HTTP: real PostgreSQL/Redis sessions, BFF/JWT guards, DTO validation and student role restrictions passed (201/400/401/403). Gemini simulated.'
    );
  } finally {
    try {
      await sessions.revokeAll(student.id);
    } finally {
      if (app) await app.close();
      await redis.onApplicationShutdown();
    }
  }
}
