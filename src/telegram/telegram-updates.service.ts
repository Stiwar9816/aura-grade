import { InjectQueue } from '@nestjs/bullmq';
import {
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { secureCompare } from '../common/security';
import { RedisService } from '../redis/redis.service';
import {
  MESSAGES_PER_MINUTE,
  TELEGRAM_QUEUE,
  TelegramJobData,
  UPDATE_DEDUPE_TTL_SECONDS,
} from './telegram.constants';
import { TelegramClient } from './telegram-client';
import { parseUpdate } from './telegram-update';

/** Webhook entry: authenticate, filter, deduplicate and enqueue. No data access happens here. */
@Injectable()
export class TelegramUpdatesService {
  constructor(
    @InjectQueue(TELEGRAM_QUEUE) private readonly queue: Queue<TelegramJobData>,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly client: TelegramClient
  ) {}

  async receive(secretHeader: unknown, body: unknown): Promise<{ ok: true }> {
    if (!this.client.enabled) throw new NotFoundException();
    if (!secureCompare(secretHeader, this.config.get('TELEGRAM_WEBHOOK_SECRET')))
      throw new ForbiddenException();
    const job = parseUpdate(body);
    if (!job) return { ok: true };
    try {
      if (!(await this.withinRate(job.telegramUserId))) return { ok: true };
      const key = `telegram:update:${job.updateId}`;
      const first = await this.redis.client.set(key, '1', {
        NX: true,
        EX: UPDATE_DEDUPE_TTL_SECONDS,
      });
      if (first !== 'OK') return { ok: true }; // duplicate delivery
      try {
        await this.queue.add('update', job, {
          jobId: `tg-update-${job.updateId}`,
          attempts: 1, // never retry: a retry could repeat a paid AI call or a reply
          removeOnComplete: { age: 60 * 60 },
          removeOnFail: { age: 24 * 60 * 60 },
        });
      } catch (error) {
        await this.redis.client.del(key).catch(() => undefined); // let Telegram redeliver
        throw error;
      }
      return { ok: true };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException();
    }
  }

  private async withinRate(telegramUserId: string): Promise<boolean> {
    const key = `telegram:rate:${telegramUserId}:${Math.floor(Date.now() / 60_000)}`;
    const count = await this.redis.client.incr(key);
    if (count === 1) await this.redis.client.expire(key, 120);
    return count <= MESSAGES_PER_MINUTE;
  }
}
