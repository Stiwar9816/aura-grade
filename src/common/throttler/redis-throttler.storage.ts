import { ThrottlerStorage } from '@nestjs/throttler';
import { ServiceUnavailableException } from '@nestjs/common';
import { RedisService } from '../../redis';
import { AuthMetricsService } from '../../observability';

const INCREMENT_SCRIPT = `
local blockedTtl = redis.call('PTTL', KEYS[2])
if blockedTtl > 0 then
  local current = tonumber(redis.call('GET', KEYS[1])) or (tonumber(ARGV[2]) + 1)
  local hitsTtl = redis.call('PTTL', KEYS[1])
  return {current, math.max(0, math.ceil(hitsTtl / 1000)), 1, math.ceil(blockedTtl / 1000)}
end

local hits = redis.call('INCR', KEYS[1])
if hits == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local hitsTtl = redis.call('PTTL', KEYS[1])

if hits > tonumber(ARGV[2]) then
  redis.call('SET', KEYS[2], '1', 'PX', ARGV[3])
  return {hits, math.max(0, math.ceil(hitsTtl / 1000)), 1, math.ceil(tonumber(ARGV[3]) / 1000)}
end

return {hits, math.max(0, math.ceil(hitsTtl / 1000)), 0, 0}
`;

export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(
    private readonly redis: RedisService,
    private readonly metrics: AuthMetricsService
  ) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string
  ): Promise<{
    totalHits: number;
    timeToExpire: number;
    isBlocked: boolean;
    timeToBlockExpire: number;
  }> {
    const prefix = `throttle:${throttlerName}:${key}`;
    let result: number[];
    try {
      result = (await this.redis.client.eval(INCREMENT_SCRIPT, {
        keys: [`${prefix}:hits`, `${prefix}:blocked`],
        arguments: [String(ttl), String(limit), String(blockDuration)],
      })) as number[];
    } catch {
      this.metrics.increment('auth_redis_error_total');
      throw new ServiceUnavailableException('El servicio de límites no está disponible.');
    }

    return {
      totalHits: Number(result[0]),
      timeToExpire: Number(result[1]),
      isBlocked: Number(result[2]) === 1,
      timeToBlockExpire: Number(result[3]),
    };
  }
}
