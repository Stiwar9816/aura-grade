import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { SessionService } from 'src/auth/session';
import { DocumentType, UserRoles } from 'src/auth/enums';
import { User } from 'src/user/entities/user.entity';
import { InstitutionApprovalStatus } from 'src/institution';

describe('SessionService', () => {
  const values = new Map<string, string>();
  const indexes = new Map<string, Set<string>>();
  const client = {
    get: jest.fn(async (key: string) => values.get(key) ?? null),
    set: jest.fn(async (key: string, value: string) => {
      values.set(key, value);
      return 'OK';
    }),
    del: jest.fn(async (key: string) => (values.delete(key) ? 1 : 0)),
    zRange: jest.fn(async (key: string) => [...(indexes.get(key) ?? [])].reverse()),
    eval: jest.fn(async (_script: string, options: { keys: string[]; arguments: string[] }) => {
      if (options.arguments.length === 8) {
        const [sessionKey, indexKey] = options.keys;
        const hash = options.arguments[4];
        values.set(sessionKey, options.arguments[0]);
        const index = indexes.get(indexKey) ?? new Set<string>();
        index.add(hash);
        indexes.set(indexKey, index);
        return 1;
      }
      if (options.keys.length === 1) {
        const index = indexes.get(options.keys[0]) ?? new Set<string>();
        for (const hash of index) values.delete(`session:${hash}`);
        const count = index.size;
        indexes.delete(options.keys[0]);
        return count;
      }
      const [sessionKey, indexKey] = options.keys;
      const removed = values.delete(sessionKey) ? 1 : 0;
      indexes.get(indexKey)?.delete(options.arguments[0]);
      if (indexes.get(indexKey)?.size === 0) indexes.delete(indexKey);
      return removed;
    }),
  };
  const redis = { client };
  const repository = {
    findOne: jest.fn(),
  };
  const config = {
    get: jest.fn((_key: string) => undefined),
  };
  const metrics = {
    increment: jest.fn(),
    observeValidation: jest.fn(),
  };
  const user: User = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Ana',
    last_name: 'Pérez',
    document_type: DocumentType.CITIZENSHIP_CARD,
    document_num: 123456789,
    phone: 3001234567,
    email: 'ana@example.com',
    password: 'hashed',
    isActive: true,
    role: UserRoles.Estudiante,
    approvalStatus: InstitutionApprovalStatus.APPROVED,
    institutionId: 'f1d24f6e-b766-4e3f-a1c9-4d4c0a58ad31',
    institution: {
      id: 'f1d24f6e-b766-4e3f-a1c9-4d4c0a58ad31',
      name: 'Universidad Aura',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    authVersion: 1,
    isPlatformAdmin: false,
    checkFieldsBeforeInsert: jest.fn(),
    checkFieldsBeforeUpdate: jest.fn(),
  };
  let service: SessionService;

  beforeEach(() => {
    values.clear();
    indexes.clear();
    jest.clearAllMocks();
    config.get.mockImplementation((_key: string) => undefined);
    repository.findOne.mockResolvedValue({ ...user });
    service = new SessionService(
      redis as any,
      repository as any,
      config as unknown as ConfigService,
      metrics as any
    );
  });

  it('stores only the hash and validates an opaque session', async () => {
    const created = await service.create(user, false, 'mfa');
    const hash = createHash('sha256').update(created.sessionToken).digest('hex');

    expect(created.sessionToken).toHaveLength(43);
    expect(values.has(`session:${hash}`)).toBe(true);
    expect([...values.keys()].some((key) => key.includes(created.sessionToken))).toBe(false);

    const validated = await service.validate(created.sessionToken);
    expect(validated?.user.id).toBe(user.id);
    expect(repository.findOne).toHaveBeenCalledWith({
      where: { id: user.id },
      relations: ['institution'],
    });
  });

  it('refuses to create a session without MFA assurance for every role', async () => {
    await expect(service.create(user)).rejects.toBeInstanceOf(ForbiddenException);
    expect(client.eval).not.toHaveBeenCalled();
  });

  it('creates and validates an administrator session after MFA', async () => {
    const administrator = { ...user, role: UserRoles.Administrador } as User;
    repository.findOne.mockResolvedValue(administrator);

    const created = await service.create(administrator, false, 'mfa');

    await expect(service.validate(created.sessionToken)).resolves.toEqual(
      expect.objectContaining({ user: expect.objectContaining({ id: administrator.id }) })
    );
  });

  it('invalidates an old session without MFA assurance', async () => {
    const created = await service.create(user, false, 'mfa');
    const hash = createHash('sha256').update(created.sessionToken).digest('hex');
    const stored = JSON.parse(values.get(`session:${hash}`) as string) as Record<string, unknown>;
    delete stored.mfaExpiresAt;
    values.set(`session:${hash}`, JSON.stringify(stored));

    await expect(service.validate(created.sessionToken)).resolves.toBeNull();
    expect(values.has(`session:${hash}`)).toBe(false);
  });

  it('invalidates a session when authVersion changes', async () => {
    const created = await service.create(user, false, 'mfa');
    repository.findOne.mockResolvedValue({ ...user, authVersion: 2 });

    await expect(service.validate(created.sessionToken)).resolves.toBeNull();
    await expect(service.validate(created.sessionToken)).resolves.toBeNull();
  });

  it('revokes all indexed sessions for a user', async () => {
    await service.create(user, false, 'mfa');
    await service.create(user, false, 'mfa');

    await expect(service.revokeAll(user.id)).resolves.toBe(2);
    expect(indexes.get(`user-sessions:${user.id}`)).toBeUndefined();
  });

  it('lists active sessions with device metadata and marks the current session', async () => {
    const first = await service.create(user, false, 'mfa', {
      browser: 'Chrome',
      deviceType: 'desktop',
      ipAddress: '203.0.113.8',
      name: 'Chrome en macOS',
      operatingSystem: 'macOS',
    });
    await service.create(user, true, 'mfa', {
      browser: 'Safari',
      deviceType: 'mobile',
      name: 'Safari en iOS',
      operatingSystem: 'iOS',
    });

    const sessions = await service.list(user, first.sessionToken);

    expect(sessions).toHaveLength(2);
    expect(sessions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          browser: 'Chrome',
          current: true,
          deviceType: 'desktop',
          ipAddress: '203.0.113.8',
          mfaExpiresAt: expect.any(String),
          name: 'Chrome en macOS',
        }),
        expect.objectContaining({
          browser: 'Safari',
          current: false,
          deviceType: 'mobile',
          name: 'Safari en iOS',
        }),
      ])
    );
    expect(JSON.stringify(sessions)).not.toContain(first.sessionToken);
  });

  it('revokes only a session owned by the requested user', async () => {
    const created = await service.create(user, false, 'mfa');
    const sessionId = createHash('sha256').update(created.sessionToken).digest('hex');

    await expect(service.revokeOwned('another-user', sessionId)).rejects.toBeInstanceOf(
      ForbiddenException
    );
    expect(values.has(`session:${sessionId}`)).toBe(true);
    await expect(service.revokeOwned(user.id, sessionId)).resolves.toBe(true);
    expect(values.has(`session:${sessionId}`)).toBe(false);
  });

  it('invalidates a session when its temporary OTP assurance expires', async () => {
    const created = await service.create(user, false, 'mfa');
    const hash = createHash('sha256').update(created.sessionToken).digest('hex');
    const stored = JSON.parse(values.get(`session:${hash}`) as string) as Record<string, unknown>;
    stored.mfaExpiresAt = Date.now() - 1;
    values.set(`session:${hash}`, JSON.stringify(stored));

    await expect(service.validate(created.sessionToken)).resolves.toBeNull();
    expect(values.has(`session:${hash}`)).toBe(false);
  });

  it('limits a remembered session to the configured OTP persistence window', async () => {
    config.get.mockImplementation((key: string) =>
      key === 'AUTH_2FA_SESSION_TTL_SECONDS' ? 600 : undefined
    );
    service = new SessionService(
      redis as any,
      repository as any,
      config as unknown as ConfigService,
      metrics as any
    );
    const startedAt = Date.now();

    const created = await service.create(user, true, 'mfa');
    const expiresAt = new Date(created.expiresAt).getTime();

    expect(expiresAt).toBeGreaterThanOrEqual(startedAt + 599_000);
    expect(expiresAt).toBeLessThanOrEqual(startedAt + 601_000);
  });

  it('reports Redis failures as service unavailable', async () => {
    client.get.mockRejectedValueOnce(new Error('Redis unavailable'));

    await expect(service.validate('opaque-token')).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });
});
