import { ConfigService } from '@nestjs/config';
import { RedisService } from 'src/redis';
import * as SentryReporter from 'src/observability/sentry-reporter';

describe('RedisService observability', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(SentryReporter, 'captureOperationalException').mockImplementation();
  });

  it('reports connection failures to Sentry at most once per minute', () => {
    const config = {
      get: jest.fn((name: string, fallback?: unknown) => {
        if (name === 'REDIS_HOST') return '127.0.0.1';
        if (name === 'REDIS_PORT') return 6379;
        return fallback;
      }),
    } as unknown as ConfigService;
    const service = new RedisService(config);
    const now = 1_787_123_450_000;
    jest.spyOn(Date, 'now').mockReturnValue(now);

    service.client.emit('error', new Error('Redis unavailable'));
    service.client.emit('error', new Error('Redis unavailable again'));

    expect(SentryReporter.captureOperationalException).toHaveBeenCalledTimes(1);
    expect(SentryReporter.captureOperationalException).toHaveBeenCalledWith(expect.any(Error), {
      component: 'dependency',
      dependency: 'redis',
      operation: 'connection',
    });
  });
});
