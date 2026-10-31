import { ForbiddenException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { TelegramUpdatesService } from 'src/telegram/telegram-updates.service';

const SECRET = 's'.repeat(40);
const body = (id = 1, over: Record<string, unknown> = {}) => ({
  update_id: id,
  message: {
    text: 'hola',
    from: { id: 9, is_bot: false },
    chat: { id: 9, type: 'private' },
    ...over,
  },
});

function fixture(enabled = true) {
  const redis = {
    client: {
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    },
  };
  const queue = { add: jest.fn().mockResolvedValue({}) };
  const config = { get: (k: string) => (k === 'TELEGRAM_WEBHOOK_SECRET' ? SECRET : undefined) };
  const client = { enabled };
  const service = new TelegramUpdatesService(
    queue as any,
    redis as any,
    config as any,
    client as any
  );
  return { service, redis, queue };
}

describe('Telegram webhook ingestion', () => {
  it('is invisible when Telegram is not configured', async () => {
    const f = fixture(false);
    await expect(f.service.receive(SECRET, body())).rejects.toThrow(NotFoundException);
    expect(f.queue.add).not.toHaveBeenCalled();
  });

  it.each([undefined, '', 'wrong', SECRET.slice(1)])(
    'rejects secret %p before touching Redis or the queue',
    async (secret) => {
      const f = fixture();
      await expect(f.service.receive(secret, body())).rejects.toThrow(ForbiddenException);
      expect(f.redis.client.incr).not.toHaveBeenCalled();
      expect(f.redis.client.set).not.toHaveBeenCalled();
      expect(f.queue.add).not.toHaveBeenCalled();
    }
  );

  it('acknowledges but does not enqueue group chats', async () => {
    const f = fixture();
    await expect(
      f.service.receive(SECRET, body(2, { chat: { id: -100, type: 'supergroup' } }))
    ).resolves.toEqual({ ok: true });
    expect(f.queue.add).not.toHaveBeenCalled();
    expect(f.redis.client.set).not.toHaveBeenCalled();
  });

  it('enqueues once, without retries, keyed by update id', async () => {
    const f = fixture();
    await f.service.receive(SECRET, body(5));
    expect(f.queue.add).toHaveBeenCalledWith(
      'update',
      { updateId: 5, chatId: '9', telegramUserId: '9', text: 'hola' },
      expect.objectContaining({ jobId: 'tg-update-5', attempts: 1 })
    );
  });

  it('drops a duplicated update', async () => {
    const f = fixture();
    f.redis.client.set.mockResolvedValue(null);
    await expect(f.service.receive(SECRET, body(5))).resolves.toEqual({ ok: true });
    expect(f.queue.add).not.toHaveBeenCalled();
  });

  it('drops messages over the per-sender rate without queueing', async () => {
    const f = fixture();
    f.redis.client.incr.mockResolvedValue(21);
    await expect(f.service.receive(SECRET, body(6))).resolves.toEqual({ ok: true });
    expect(f.queue.add).not.toHaveBeenCalled();
    expect(f.redis.client.set).not.toHaveBeenCalled();
  });

  it('releases the dedupe mark and asks Telegram to redeliver when queueing fails', async () => {
    const f = fixture();
    f.queue.add.mockRejectedValue(new Error('redis down'));
    await expect(f.service.receive(SECRET, body(7))).rejects.toThrow(ServiceUnavailableException);
    expect(f.redis.client.del).toHaveBeenCalledWith('telegram:update:7');
  });

  it('fails closed when Redis is unavailable', async () => {
    const f = fixture();
    f.redis.client.incr.mockRejectedValue(new Error('down'));
    await expect(f.service.receive(SECRET, body(8))).rejects.toThrow(ServiceUnavailableException);
    expect(f.queue.add).not.toHaveBeenCalled();
  });
});
