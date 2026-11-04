import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { UserRoles } from 'src/auth/enums';
import { SessionService } from 'src/auth/session';
import { BffAuthGuard } from 'src/common/guards/bff-auth.guard';
import { TelegramClient } from 'src/telegram/telegram-client';
import {
  TelegramLinkController,
  TelegramWebhookController,
} from 'src/telegram/telegram.controller';
import { TelegramLinkService } from 'src/telegram/telegram-link.service';
import { TelegramUpdatesService } from 'src/telegram/telegram-updates.service';

describe('Telegram HTTP boundary', () => {
  let app: INestApplication;
  const student = '00000000-0000-4000-8000-000000000002';
  const SECRET = 't'.repeat(40);
  const updates = { receive: jest.fn(async () => ({ ok: true })) };
  const links = {
    status: jest.fn(async () => ({ linked: false })),
    createToken: jest.fn(async () => ({ token: 'TOK', expiresAt: new Date('2030-01-01') })),
    revoke: jest.fn(async () => true),
  };
  const config = new ConfigService({
    BFF_SHARED_SECRET: 'test-secret',
    STATE: 'prod',
    TELEGRAM_BOT_USERNAME: 'AuraBot',
  });

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [TelegramWebhookController, TelegramLinkController],
      providers: [
        { provide: TelegramUpdatesService, useValue: updates },
        { provide: TelegramLinkService, useValue: links },
        { provide: TelegramClient, useValue: { enabled: true } },
        { provide: ConfigService, useValue: config },
        {
          provide: SessionService,
          useValue: {
            validate: async (token: string) =>
              token === 'student-session'
                ? { user: { id: student, role: UserRoles.Estudiante } }
                : token === 'teacher-session'
                  ? { user: { id: student, role: UserRoles.Docente } }
                  : null,
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    app.useGlobalGuards(new BffAuthGuard(config));
    await app.init();
  });
  afterAll(() => app.close());

  const server = () => request(app.getHttpServer());
  const asStudent = (r: request.Test) =>
    r.set('x-bff-secret', 'test-secret').set('Authorization', 'Bearer student-session');

  describe('webhook', () => {
    const update = {
      update_id: 1,
      message: { text: 'x', from: { id: 1 }, chat: { id: 1 }, extra: { a: 1 } },
    };

    it('is reachable without the BFF secret and forwards the Telegram secret header and raw body', async () => {
      await server()
        .post('/api/telegram/webhook')
        .set('x-telegram-bot-api-secret-token', SECRET)
        .send(update)
        .expect(200)
        .expect('Cache-Control', 'no-store');
      expect(updates.receive).toHaveBeenLastCalledWith(SECRET, update);
    });

    it('lets the service reject a bad secret', async () => {
      updates.receive.mockRejectedValueOnce(new (require('@nestjs/common').ForbiddenException)());
      await server().post('/api/telegram/webhook').send(update).expect(403);
    });
  });

  describe('BFF protection stays intact for every other route', () => {
    it.each([
      ['get', '/api/telegram/link'],
      ['post', '/api/telegram/link/token'],
      ['delete', '/api/telegram/link'],
    ])('%s %s needs the BFF secret', async (method, path) => {
      await (server() as any)
        [method](path)
        .set('Authorization', 'Bearer student-session')
        .expect(403);
    });

    it('needs a valid session', async () => {
      await server().get('/api/telegram/link').set('x-bff-secret', 'test-secret').expect(401);
    });
  });

  describe('account linking', () => {
    it('is reserved to students', async () => {
      await server()
        .post('/api/telegram/link/token')
        .set('x-bff-secret', 'test-secret')
        .set('Authorization', 'Bearer teacher-session')
        .expect(403);
      expect(links.createToken).not.toHaveBeenCalled();
    });

    it('issues a deep link for the authenticated student only', async () => {
      const res = await asStudent(server().post('/api/telegram/link/token'))
        .send({})
        .expect(201)
        .expect('Cache-Control', 'no-store');
      expect(links.createToken).toHaveBeenLastCalledWith(student);
      expect(res.body.url).toBe('https://t.me/AuraBot?start=TOK');
    });

    it('reports status and unlinks for the session user, ignoring client-supplied ids', async () => {
      await asStudent(server().get('/api/telegram/link')).expect(200);
      expect(links.status).toHaveBeenLastCalledWith(student);
      await asStudent(server().delete('/api/telegram/link')).expect(200);
      expect(links.revoke).toHaveBeenLastCalledWith(student);
      await asStudent(server().post('/api/telegram/link/token'))
        .send({ userId: 'other' })
        .expect(201);
      expect(links.createToken).toHaveBeenLastCalledWith(student);
    });
  });
});
