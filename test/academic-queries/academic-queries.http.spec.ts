import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import request = require('supertest');
import { AcademicQueriesController } from 'src/academic-queries/academic-queries.controller';
import { AcademicQueriesService } from 'src/academic-queries/academic-queries.service';
import { SessionService } from 'src/auth/session';
import { BffAuthGuard } from 'src/common/guards/bff-auth.guard';
import { UserRoles } from 'src/auth/enums';

describe('academic query HTTP boundary', () => {
  let app: INestApplication;
  const course = '00000000-0000-4000-8000-000000000001';
  const student = '00000000-0000-4000-8000-000000000002';
  const base = `/api/courses/${course}/academic-queries/activities`;
  const queries = {
    activities: jest.fn(async () => ({ items: [] })),
    result: jest.fn(async () => ({ evaluation: null })),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AcademicQueriesController],
      providers: [
        { provide: AcademicQueriesService, useValue: queries },
        {
          provide: SessionService,
          useValue: {
            validate: async (token) =>
              token === 'student-session'
                ? { user: { id: student, role: UserRoles.Estudiante } }
                : token === 'teacher-session'
                  ? { user: { id: course, role: UserRoles.Docente } }
                  : null,
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    // Match production (transform is not enabled globally).
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    app.useGlobalGuards(
      new BffAuthGuard(new ConfigService({ BFF_SHARED_SECRET: 'test-secret', STATE: 'prod' }))
    );
    await app.init();
  });
  afterAll(() => app.close());
  const get = (path = base) =>
    request(app.getHttpServer())
      .get(path)
      .set('x-bff-secret', 'test-secret')
      .set('Authorization', 'Bearer student-session');
  it('uses verified session identity and keeps responses private', async () => {
    await get(`${base}?page=2&limit=5&upcoming=true`)
      .expect(200)
      .expect('Cache-Control', 'no-store');
    expect(queries.activities).toHaveBeenLastCalledWith(
      student,
      course,
      expect.objectContaining({ page: 2, limit: 5, upcoming: true })
    );
    await get(`${base}/${course}/result`).expect(200).expect('Cache-Control', 'no-store');
    expect(queries.result).toHaveBeenLastCalledWith(student, course, course);
  });
  it.each(['studentId=other', 'upcoming=1', 'limit=51', 'page=0', 'page=2&page=3'])(
    'rejects invalid or injected query %s',
    async (query) => {
      await get(`${base}?${query}`).expect(400);
    }
  );
  it('requires a trusted BFF, valid session, and student role', async () => {
    await request(app.getHttpServer()).get(base).expect(403);
    await request(app.getHttpServer()).get(base).set('x-bff-secret', 'test-secret').expect(401);
    await get().set('Authorization', 'Bearer teacher-session').expect(403);
    await get('/api/courses/not-a-uuid/academic-queries/activities').expect(400);
  });
});
