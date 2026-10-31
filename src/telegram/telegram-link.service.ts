import { HttpException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { DataSource, IsNull, MoreThan, Repository } from 'typeorm';
import { AcademicAccessService } from '../academic-access/academic-access.service';
import { LINK_TOKENS_PER_HOUR, LINK_TOKEN_TTL_MS } from './telegram.constants';
import { TelegramLinkEntity } from './entities/telegram-link.entity';
import { TelegramLinkTokenEntity } from './entities/telegram-link-token.entity';

export type LinkOutcome = 'LINKED' | 'INVALID_TOKEN' | 'ACCESS_DENIED' | 'TELEGRAM_IN_USE';

export const LINK_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
class Abort extends Error {
  constructor(readonly outcome: LinkOutcome) {
    super(outcome);
  }
}
const hash = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class TelegramLinkService {
  constructor(
    private readonly db: DataSource,
    private readonly access: AcademicAccessService,
    @InjectRepository(TelegramLinkEntity) private readonly links: Repository<TelegramLinkEntity>,
    @InjectRepository(TelegramLinkTokenEntity)
    private readonly tokens: Repository<TelegramLinkTokenEntity>
  ) {}

  /** The raw token is returned once and never stored. */
  async createToken(userId: string) {
    await this.access.requireStudent(userId);
    const recent = await this.tokens.countBy({
      userId,
      createdAt: MoreThan(new Date(Date.now() - 60 * 60 * 1000)),
    });
    if (recent >= LINK_TOKENS_PER_HOUR)
      throw new HttpException('Demasiados intentos. Inténtalo de nuevo más tarde.', 429);
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + LINK_TOKEN_TTL_MS);
    // A fresh code supersedes older unused ones.
    await this.db.transaction(async (manager) => {
      await manager.update(
        TelegramLinkTokenEntity,
        { userId, usedAt: IsNull() },
        { usedAt: new Date() }
      );
      await manager.insert(TelegramLinkTokenEntity, {
        userId,
        tokenHash: hash(token),
        expiresAt,
      });
    });
    return { token, expiresAt };
  }

  async status(userId: string) {
    const link = await this.links.findOne({ where: { userId, revokedAt: IsNull() } });
    return link ? { linked: true, linkedAt: link.linkedAt } : { linked: false };
  }

  async revoke(userId: string): Promise<boolean> {
    const result = await this.links.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() }
    );
    return (result.affected ?? 0) > 0;
  }

  async revokeByTelegram(telegramUserId: string): Promise<boolean> {
    const result = await this.links.update(
      { telegramUserId, revokedAt: IsNull() },
      { revokedAt: new Date() }
    );
    return (result.affected ?? 0) > 0;
  }

  /** Identity comes only from this validated, unrevoked link: never from message text. */
  async resolve(telegramUserId: string, chatId: string): Promise<TelegramLinkEntity | null> {
    const link = await this.links.findOne({ where: { telegramUserId, revokedAt: IsNull() } });
    return link && link.chatId === chatId ? link : null;
  }

  async selectCourse(linkId: string, courseId: string | null) {
    await this.links.update({ id: linkId }, { selectedCourseId: courseId });
  }

  async consume(rawToken: string, telegramUserId: string, chatId: string): Promise<LinkOutcome> {
    if (!LINK_TOKEN_PATTERN.test(rawToken)) return 'INVALID_TOKEN';
    try {
      await this.db.transaction(async (manager) => {
        // Atomic one-use claim: an expired, used or unknown token matches no row.
        const claimed = await manager
          .createQueryBuilder()
          .update(TelegramLinkTokenEntity)
          .set({ usedAt: () => 'now()' })
          .where('token_hash = :hash AND used_at IS NULL AND expires_at > now()', {
            hash: hash(rawToken),
          })
          .returning('user_id')
          .execute();
        const userId: string | undefined = claimed.raw?.[0]?.user_id;
        if (!userId) throw new Abort('INVALID_TOKEN');
        try {
          await this.access.requireStudent(userId);
        } catch {
          throw new Abort('ACCESS_DENIED');
        }
        const other = await manager
          .createQueryBuilder(TelegramLinkEntity, 'l')
          .where('l.telegram_user_id = :telegramUserId AND l.revoked_at IS NULL', {
            telegramUserId,
          })
          .andWhere('l.user_id <> :userId', { userId })
          .getCount();
        if (other) throw new Abort('TELEGRAM_IN_USE');
        await manager.update(
          TelegramLinkEntity,
          { userId, revokedAt: IsNull() },
          { revokedAt: new Date() }
        );
        await manager.insert(TelegramLinkEntity, { userId, telegramUserId, chatId });
      });
      return 'LINKED';
    } catch (error) {
      if (error instanceof Abort) return error.outcome;
      if ((error as { code?: string })?.code === '23505') return 'TELEGRAM_IN_USE';
      throw error;
    }
  }
}
