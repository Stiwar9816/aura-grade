import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { CourseDocumentsController } from 'src/course-documents/course-documents.controller';
import { CourseDocumentsService } from 'src/course-documents/course-documents.service';
import { JwtAuthGuard } from 'src/auth/guards';
import { BffAuthGuard } from 'src/common/guards/bff-auth.guard';
import { configureGraphqlUploads } from 'src/common/graphql/graphql-upload.config';
import { UserRoles } from 'src/auth/enums';

describe('course library HTTP contract', () => {
  let app: INestApplication;
  const course = '00000000-0000-4000-8000-000000000001';
  const doc = '00000000-0000-4000-8000-000000000002';
  const version = '00000000-0000-4000-8000-000000000003';
  const service = { create: jest.fn(), upload: jest.fn(), review: jest.fn(), download: jest.fn() };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [CourseDocumentsController],
      providers: [{ provide: CourseDocumentsService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context) => {
          const req = context.switchToHttp().getRequest();
          if (req.headers.authorization !== 'Bearer valid-session')
            throw new UnauthorizedException();
          req.user = { id: 'authenticated-teacher', role: UserRoles.Docente };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
    );
    app.useGlobalGuards(
      new BffAuthGuard({
        get: (key) => (key === 'BFF_SHARED_SECRET' ? 'test-secret' : 'prod'),
      } as never)
    );
    configureGraphqlUploads(app);
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    service.upload.mockResolvedValue({ id: version, status: 'DRAFT' });
  });

  it('accepts REST multipart without GraphQL consuming the body first', async () => {
    await request(app.getHttpServer())
      .post(`/api/courses/${course}/documents/${doc}/versions`)
      .set('Authorization', 'Bearer valid-session')
      .set('x-bff-secret', 'test-secret')
      .set('Idempotency-Key', version)
      .attach('file', Buffer.from('%PDF-test'), {
        filename: 'guide.pdf',
        contentType: 'application/pdf',
      })
      .expect(201)
      .expect({ id: version, status: 'DRAFT' });
    expect(service.upload).toHaveBeenCalledWith(
      course,
      doc,
      expect.objectContaining({ id: 'authenticated-teacher' }),
      expect.objectContaining({ buffer: Buffer.from('%PDF-test') }),
      version
    );
  });
  it('rejects an unauthenticated or non-BFF upload before the service', async () => {
    await request(app.getHttpServer())
      .post(`/api/courses/${course}/documents/${doc}/versions`)
      .set('x-bff-secret', 'test-secret')
      .expect(401);
    await request(app.getHttpServer())
      .post(`/api/courses/${course}/documents/${doc}/versions`)
      .set('Authorization', 'Bearer valid-session')
      .expect(403);
    expect(service.upload).not.toHaveBeenCalled();
  });
  it('rejects false confirmation, unknown fields and invalid titles', async () => {
    await request(app.getHttpServer())
      .post(`/api/courses/${course}/documents/${doc}/versions/${version}/review`)
      .set('Authorization', 'Bearer valid-session')
      .set('x-bff-secret', 'test-secret')
      .send({ confirmed: false, contentHash: 'a'.repeat(64), role: 'Docente' })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/api/courses/${course}/documents`)
      .set('Authorization', 'Bearer valid-session')
      .set('x-bff-secret', 'test-secret')
      .send({ title: '   ', kind: 'GUIDE' })
      .expect(400);
    expect(service.review).not.toHaveBeenCalled();
    expect(service.create).not.toHaveBeenCalled();
  });
  it('serves signed links with no-store', async () => {
    service.download.mockResolvedValue('https://signed.example/file');
    await request(app.getHttpServer())
      .get(`/api/courses/${course}/documents/${doc}/versions/${version}/download`)
      .set('Authorization', 'Bearer valid-session')
      .set('x-bff-secret', 'test-secret')
      .expect('Cache-Control', 'no-store')
      .expect(200)
      .expect({ url: 'https://signed.example/file' });
  });
});
