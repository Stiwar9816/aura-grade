import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { CoursePreparationController } from 'src/course-preparation/course-preparation.controller';
import { CoursePreparationService } from 'src/course-preparation/course-preparation.service';
import { JwtAuthGuard } from 'src/auth/guards';
import { BffAuthGuard } from 'src/common/guards/bff-auth.guard';
import { UserRoles } from 'src/auth/enums';

describe('course preparation HTTP', () => {
  let app: INestApplication;
  const id = '00000000-0000-4000-8000-000000000001';
  const base = `/api/courses/${id}/documents/preparation`;
  const service = {
    list: jest.fn(async () => ({ items: [], sources: [] })),
    confirm: jest.fn(async () => ({ assignmentId: id })),
  };
  const input = {
    confirmed: true,
    activityHash: 'a'.repeat(64),
    guideVersionId: id,
    scheduleVersionId: '00000000-0000-4000-8000-000000000002',
    guideSection: 'Página 1',
    scheduleSection: 'Semana 2',
  };
  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      controllers: [CoursePreparationController],
      providers: [{ provide: CoursePreparationService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx) => {
          const req = ctx.switchToHttp().getRequest();
          if (req.headers.authorization !== 'Bearer test') throw new UnauthorizedException();
          req.user = { id, role: req.headers['x-test-role'] || UserRoles.Docente };
          return true;
        },
      })
      .compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
    );
    app.useGlobalGuards(
      new BffAuthGuard({
        get: (key) => (key === 'BFF_SHARED_SECRET' ? 'test-secret' : 'prod'),
      } as never)
    );
    await app.init();
  });
  afterAll(() => app.close());
  it('returns private paginated data and validates confirmation', async () => {
    await request(app.getHttpServer())
      .get(base + '?page=2&limit=10')
      .set('Authorization', 'Bearer test')
      .set('x-bff-secret', 'test-secret')
      .expect(200)
      .expect('Cache-Control', 'no-store');
    expect(service.list).toHaveBeenCalledWith(id, expect.objectContaining({ id }), 2, 10);
    await request(app.getHttpServer())
      .post(base + '/' + id + '/confirm')
      .set('Authorization', 'Bearer test')
      .set('x-bff-secret', 'test-secret')
      .send(input)
      .expect(201);
  });
  it('rejects invalid, unauthenticated, foreign actor and student writes', async () => {
    for (const body of [
      { ...input, confirmed: false },
      { ...input, guideSection: '  ' },
      { ...input, actorId: id },
      { ...input, activityHash: 'bad' },
    ])
      await request(app.getHttpServer())
        .post(base + '/' + id + '/confirm')
        .set('Authorization', 'Bearer test')
        .set('x-bff-secret', 'test-secret')
        .send(body)
        .expect(400);
    await request(app.getHttpServer())
      .post(base + '/' + id + '/confirm')
      .set('Authorization', 'Bearer test')
      .set('x-bff-secret', 'test-secret')
      .set('x-test-role', UserRoles.Estudiante)
      .send(input)
      .expect(403);
    await request(app.getHttpServer()).get(base).set('x-bff-secret', 'test-secret').expect(401);
    await request(app.getHttpServer()).get(base).set('Authorization', 'Bearer test').expect(403);
  });
});
