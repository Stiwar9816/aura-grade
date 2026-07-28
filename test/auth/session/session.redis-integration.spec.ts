import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { SessionService } from 'src/auth/session';
import { RedisService } from 'src/redis';
import { DocumentType, UserRoles } from 'src/auth/enums';
import { User } from 'src/user/entities/user.entity';
import { InstitutionApprovalStatus } from 'src/institution';

const describeRedis = process.env.RUN_REDIS_INTEGRATION === 'true' ? describe : describe.skip;

describeRedis('SessionService Redis integration', () => {
  jest.setTimeout(15000);
  const user: User = {
    id: randomUUID(),
    name: 'Integration',
    last_name: 'Test',
    document_type: DocumentType.CITIZENSHIP_CARD,
    document_num: 987654321,
    phone: 3999999999,
    email: `integration-${randomUUID()}@example.com`,
    password: 'hashed',
    isActive: true,
    role: UserRoles.Estudiante,
    approvalStatus: InstitutionApprovalStatus.APPROVED,
    institutionId: 'f1d24f6e-b766-4e3f-a1c9-4d4c0a58ad31',
    institution: {
      id: 'f1d24f6e-b766-4e3f-a1c9-4d4c0a58ad31',
      name: 'Universidad Aura',
      slug: 'universidad-aura',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    authVersion: 1,
    checkFieldsBeforeInsert: jest.fn(),
    checkFieldsBeforeUpdate: jest.fn(),
  };
  const config = {
    get: (key: string) => {
      if (key === 'REDIS_URL') return process.env.REDIS_URL ?? 'redis://localhost:6379';
      if (key === 'SESSION_MAX_PER_USER') return 5;
      return undefined;
    },
  } as unknown as ConfigService;
  const repository = {
    findOne: jest.fn(async () => ({ ...user })),
  };
  const metrics = {
    increment: jest.fn(),
    observeValidation: jest.fn(),
  };
  let redis: RedisService;
  let firstInstance: SessionService;
  let secondInstance: SessionService;

  beforeAll(async () => {
    redis = new RedisService(config);
    await redis.onModuleInit();
    firstInstance = new SessionService(redis, repository as any, config, metrics as any);
    secondInstance = new SessionService(redis, repository as any, config, metrics as any);
  });

  afterAll(async () => {
    if (firstInstance) await firstInstance.revokeAll(user.id);
    if (redis) await redis.onApplicationShutdown();
  });

  it('shares sessions across instances and enforces the concurrent limit atomically', async () => {
    const sessions = [];
    for (let index = 0; index < 6; index += 1) sessions.push(await firstInstance.create(user));

    await expect(secondInstance.validate(sessions[0].sessionToken)).resolves.toBeNull();
    await expect(secondInstance.validate(sessions[5].sessionToken)).resolves.toMatchObject({
      user: { id: user.id },
    });
    await expect(secondInstance.revokeAll(user.id)).resolves.toBe(5);
  });
});
