import { ServiceUnavailableException } from '@nestjs/common';
import { RedisThrottlerStorage } from 'src/common/throttler';

describe('RedisThrottlerStorage', () => {
  const evalMock = jest.fn();
  const metrics = { increment: jest.fn() };
  const storage = new RedisThrottlerStorage({ client: { eval: evalMock } } as any, metrics as any);

  beforeEach(() => jest.clearAllMocks());

  it('maps the atomic Redis result to the throttler contract', async () => {
    evalMock.mockResolvedValue([3, 42, 0, 0]);

    await expect(storage.increment('key', 60000, 5, 60000, 'short')).resolves.toEqual({
      totalHits: 3,
      timeToExpire: 42,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
  });

  it('returns 503 semantics when Redis is unavailable', async () => {
    evalMock.mockRejectedValue(new Error('down'));

    await expect(storage.increment('key', 60000, 5, 60000, 'short')).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
    expect(metrics.increment).toHaveBeenCalledWith('auth_redis_error_total');
  });
});
