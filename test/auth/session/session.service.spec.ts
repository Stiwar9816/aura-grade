import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { SessionService } from 'src/auth/session';
import { DocumentType, UserRoles } from 'src/auth/enums';
import { User } from 'src/user/entities/user.entity';

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
    findOneBy: jest.fn(),
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
    authVersion: 1,
    checkFieldsBeforeInsert: jest.fn(),
    checkFieldsBeforeUpdate: jest.fn(),
  };
  let service: SessionService;

  beforeEach(() => {
    values.clear();
    indexes.clear();
    jest.clearAllMocks();
    repository.findOneBy.mockResolvedValue({ ...user });
    service = new SessionService(
      redis as any,
      repository as any,
      config as unknown as ConfigService,
      metrics as any
    );
  });

  it('stores only the hash and validates an opaque session', async () => {
    const created = await service.create(user);
    const hash = createHash('sha256').update(created.sessionToken).digest('hex');

    expect(created.sessionToken).toHaveLength(43);
    expect(values.has(`session:${hash}`)).toBe(true);
    expect([...values.keys()].some((key) => key.includes(created.sessionToken))).toBe(false);

    const validated = await service.validate(created.sessionToken);
    expect(validated?.user.id).toBe(user.id);
    expect(repository.findOneBy).toHaveBeenCalledWith({ id: user.id });
  });

  it('invalidates a session when authVersion changes', async () => {
    const created = await service.create(user);
    repository.findOneBy.mockResolvedValue({ ...user, authVersion: 2 });

    await expect(service.validate(created.sessionToken)).resolves.toBeNull();
    await expect(service.validate(created.sessionToken)).resolves.toBeNull();
  });

  it('revokes all indexed sessions for a user', async () => {
    await service.create(user);
    await service.create(user);

    await expect(service.revokeAll(user.id)).resolves.toBe(2);
    expect(indexes.get(`user-sessions:${user.id}`)).toBeUndefined();
  });

  it('reports Redis failures as service unavailable', async () => {
    client.get.mockRejectedValueOnce(new Error('Redis unavailable'));

    await expect(service.validate('opaque-token')).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });
});
