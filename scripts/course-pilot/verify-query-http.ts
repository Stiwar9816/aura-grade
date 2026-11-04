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
import { AcademicQueriesService } from '../../src/academic-queries/academic-queries.service';
import { AcademicQueriesController } from '../../src/academic-queries/academic-queries.controller';

/** Real HTTP, PostgreSQL and Redis; synthetic session issuance, no OTP/email. */
export async function verifyQueryHttp(
  manager: EntityManager,
  queries: AcademicQueriesService,
  student: User,
  courseId: string,
  assignmentId: string
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
      controllers: [AcademicQueriesController],
      providers: [
        { provide: AcademicQueriesService, useValue: queries },
        { provide: SessionService, useValue: sessions },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    app.useGlobalGuards(new BffAuthGuard(config));
    await app.listen(0, '127.0.0.1');
    const base = `${await app.getUrl()}/api/courses/${courseId}/academic-queries/activities`;
    const headers = { authorization: `Bearer ${sessionToken}`, 'x-bff-secret': secret };
    const get = (path = '', override = headers) => fetch(base + path, { headers: override });
    const response = await get(`/${assignmentId}/result`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal((await response.json()).evaluation.totalScore, 0);
    assert.equal((await get('', { 'x-bff-secret': secret } as typeof headers)).status, 401);
    assert.equal(
      (await get('', { authorization: `Bearer ${sessionToken}` } as typeof headers)).status,
      403
    );
    assert.equal((await get('?studentId=another')).status, 400);
    await manager.createQueryBuilder().relation(Course, 'users').of(courseId).remove(student.id);
    assert.equal((await get()).status, 403);
    await manager.createQueryBuilder().relation(Course, 'users').of(courseId).add(student.id);
    assert.equal((await get()).status, 200);
    await manager.getRepository(User).update(student.id, { isActive: false });
    assert.equal((await get()).status, 401);
    await manager.getRepository(User).update(student.id, { isActive: true });
    console.log(
      'Academic query HTTP: PostgreSQL + Redis sessions + real guards passed (200/400/401/403), own zero grade, enrollment removal and account deactivation.'
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
