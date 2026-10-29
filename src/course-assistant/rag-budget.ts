import { HttpException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { RedisService } from '../redis/redis.service';
// Check every bound before incrementing any counter. Shared actor lock spans courses/modes.
export const RESERVE_RAG = `
if redis.call('EXISTS',KEYS[1]) == 1 then return -1 end
if tonumber(redis.call('GET',KEYS[2]) or '0') + tonumber(ARGV[2]) > tonumber(ARGV[3]) then return -2 end
if tonumber(redis.call('GET',KEYS[3]) or '0') + tonumber(ARGV[2]) > tonumber(ARGV[4]) then return -2 end
redis.call('SET',KEYS[1],ARGV[1],'EX',90)
redis.call('INCRBY',KEYS[2],ARGV[2]); redis.call('EXPIRE',KEYS[2],172800)
redis.call('INCRBY',KEYS[3],ARGV[2]); redis.call('EXPIRE',KEYS[3],172800)
return 1`;
const RELEASE = `if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0`;
@Injectable()
export class RagBudget {
  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService
  ) {}
  private limit(name: string, fallback: number) {
    const n = Number(this.config.get(name, fallback));
    if (!Number.isInteger(n) || n < 1 || n > 100000)
      throw new ServiceUnavailableException('Límites del asistente no configurados.');
    return n;
  }
  async reserve(
    actorId: string,
    kind: 'question' | 'index',
    units: number
  ): Promise<() => Promise<void>> {
    if (!Number.isInteger(units) || units < 1 || units > 16)
      throw new Error('Invalid budget reservation');
    const day = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const lock = `rag:lock:${actorId}`,
      token = randomUUID();
    const keys = [lock, `rag:${kind}:${day}:actor:${actorId}`, `rag:${kind}:${day}:global`];
    const args = [
      token,
      String(units),
      String(
        this.limit(
          kind === 'question' ? 'RAG_DAILY_QUESTIONS' : 'RAG_DAILY_CHUNKS',
          kind === 'question' ? 20 : 512
        )
      ),
      String(
        this.limit(
          kind === 'question' ? 'RAG_GLOBAL_QUESTIONS' : 'RAG_GLOBAL_CHUNKS',
          kind === 'question' ? 1000 : 4096
        )
      ),
    ];
    let result: number;
    try {
      result = Number(await this.redis.client.eval(RESERVE_RAG, { keys, arguments: args }));
    } catch {
      throw new ServiceUnavailableException(
        'El control de consumo no está disponible. Intenta más tarde.'
      );
    }
    if (result !== 1)
      throw new HttpException(
        result === -1
          ? 'Ya tienes una consulta en curso.'
          : 'Se alcanzó el límite diario del asistente.',
        429
      );
    return async () => {
      try {
        await this.redis.client.eval(RELEASE, { keys: [lock], arguments: [token] });
      } catch {
        /* Lease expires; never retry a paid request. */
      }
    };
  }
}
