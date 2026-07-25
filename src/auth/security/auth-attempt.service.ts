import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'crypto';
import { setTimeout as delay } from 'timers/promises';
import { AuthMetricsService } from '../../observability';
import { RedisService } from '../../redis';

const FAILURE_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return count
`;

@Injectable()
export class AuthAttemptService {
  private readonly logger = new Logger(AuthAttemptService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly metrics: AuthMetricsService
  ) {}

  async registerFailure(identity: string): Promise<void> {
    try {
      const count = Number(
        await this.redis.client.eval(FAILURE_SCRIPT, {
          keys: [this.key(identity)],
          arguments: [String(15 * 60 * 1000)],
        })
      );
      await delay(Math.min(1500, Math.max(200, count * 200)));
    } catch (error) {
      this.metrics.increment('auth_redis_error_total');
      this.logger.error(
        'Redis failed while recording an authentication failure',
        (error as Error).stack
      );
      throw new ServiceUnavailableException('El servicio de autenticación no está disponible.');
    }
  }

  async clear(identity: string): Promise<void> {
    try {
      await this.redis.client.del(this.key(identity));
    } catch (error) {
      this.metrics.increment('auth_redis_error_total');
      this.logger.error(
        'Redis failed while clearing authentication failures',
        (error as Error).stack
      );
      throw new ServiceUnavailableException('El servicio de autenticación no está disponible.');
    }
  }

  private key(identity: string): string {
    const hash = createHash('sha256').update(identity).digest('hex');
    return `auth-failures:${hash}`;
  }
}
