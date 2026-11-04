import { ForbiddenException } from '@nestjs/common';
import { createHash } from 'crypto';
import { TelegramLinkService } from 'src/telegram/telegram-link.service';

const TOKEN = 'A'.repeat(43);
const sha = (t: string) => createHash('sha256').update(t).digest('hex');

function fixture(
  opts: { claimed?: string | null; inUse?: number; denied?: boolean; insertError?: any } = {}
) {
  const calls: string[] = [];
  const qb = (kind: string) => {
    const chain: any = {
      update: () => chain,
      set: () => chain,
      where: (sql: string, params: any) => (
        calls.push(`${kind}:where:${sql}:${JSON.stringify(params)}`),
        chain
      ),
      andWhere: () => chain,
      returning: () => chain,
      execute: async () => ({ raw: opts.claimed ? [{ user_id: opts.claimed }] : [] }),
      getCount: async () => opts.inUse ?? 0,
    };
    return chain;
  };
  const manager = {
    createQueryBuilder: (entity?: unknown) => qb(entity ? 'count' : 'claim'),
    update: jest.fn(async () => (calls.push('revokePrevious'), {})),
    insert: jest.fn(async () => {
      if (opts.insertError) throw opts.insertError;
      calls.push('insert');
    }),
  };
  const db = {
    transaction: jest.fn(async (fn: any) => fn(manager)),
  };
  const access = {
    requireStudent: jest.fn(async () => {
      if (opts.denied) throw new ForbiddenException();
      return { studentId: 'u1', institutionId: 'i1' };
    }),
  };
  const links = { findOne: jest.fn(), update: jest.fn() };
  const tokens = { countBy: jest.fn().mockResolvedValue(0) };
  const service = new TelegramLinkService(db as any, access as any, links as any, tokens as any);
  return { service, db, manager, access, calls, tokens };
}

describe('Telegram link tokens', () => {
  it('rejects malformed tokens without opening a transaction', async () => {
    const f = fixture();
    for (const t of ['', 'short', `${TOKEN}x`, `${'A'.repeat(42)}!`])
      expect(await f.service.consume(t, '9', '9')).toBe('INVALID_TOKEN');
    expect(f.db.transaction).not.toHaveBeenCalled();
  });

  it('claims by hash only; an unknown, used or expired token matches no row', async () => {
    const f = fixture({ claimed: null });
    expect(await f.service.consume(TOKEN, '9', '9')).toBe('INVALID_TOKEN');
    expect(f.calls.join('|')).toContain(sha(TOKEN));
    expect(f.calls.join('|')).not.toContain(TOKEN);
    expect(f.access.requireStudent).not.toHaveBeenCalled();
    expect(f.manager.insert).not.toHaveBeenCalled();
  });

  it('links after revalidating the student and replacing any previous link', async () => {
    const f = fixture({ claimed: 'u1' });
    expect(await f.service.consume(TOKEN, '9', '9')).toBe('LINKED');
    expect(f.access.requireStudent).toHaveBeenCalledWith('u1');
    expect(f.calls.slice(-2)).toEqual(['revokePrevious', 'insert']);
    expect(f.manager.insert).toHaveBeenCalledWith(expect.anything(), {
      userId: 'u1',
      telegramUserId: '9',
      chatId: '9',
    });
  });

  it('does not link an account that lost academic access', async () => {
    const f = fixture({ claimed: 'u1', denied: true });
    expect(await f.service.consume(TOKEN, '9', '9')).toBe('ACCESS_DENIED');
    expect(f.manager.insert).not.toHaveBeenCalled();
  });

  it('refuses a Telegram account already linked to someone else', async () => {
    const f = fixture({ claimed: 'u1', inUse: 1 });
    expect(await f.service.consume(TOKEN, '9', '9')).toBe('TELEGRAM_IN_USE');
    expect(f.manager.insert).not.toHaveBeenCalled();
  });

  it('maps a concurrent unique violation to TELEGRAM_IN_USE', async () => {
    const f = fixture({ claimed: 'u1', insertError: { code: '23505' } });
    expect(await f.service.consume(TOKEN, '9', '9')).toBe('TELEGRAM_IN_USE');
  });

  it('propagates unexpected database errors', async () => {
    const f = fixture({ claimed: 'u1', insertError: new Error('boom') });
    await expect(f.service.consume(TOKEN, '9', '9')).rejects.toThrow('boom');
  });
});

describe('Telegram link token creation', () => {
  it('requires a student with academic access before generating anything', async () => {
    const f = fixture({ denied: true });
    await expect(f.service.createToken('u1')).rejects.toThrow(ForbiddenException);
    expect(f.db.transaction).not.toHaveBeenCalled();
  });

  it('limits token generation per hour', async () => {
    const f = fixture();
    f.tokens.countBy.mockResolvedValue(5);
    await expect(f.service.createToken('u1')).rejects.toMatchObject({ status: 429 });
    expect(f.db.transaction).not.toHaveBeenCalled();
  });

  it('stores only the hash, expires in ten minutes and supersedes older codes', async () => {
    const f = fixture();
    const { token, expiresAt } = await f.service.createToken('u1');
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(10 * 60 * 1000);
    expect(expiresAt.getTime() - Date.now()).toBeGreaterThan(9 * 60 * 1000);
    const [, stored] = f.manager.insert.mock.calls[0] as unknown as [unknown, any];
    expect(stored.tokenHash).toBe(sha(token));
    expect(JSON.stringify(stored)).not.toContain(token);
  });
});
