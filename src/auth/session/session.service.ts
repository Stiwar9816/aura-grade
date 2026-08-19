import {
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { UserRoles } from '../enums';
import { User } from '../../user/entities/user.entity';
import { RedisService } from '../../redis';
import { AuthMetricsService } from '../../observability';
import { CreatedSession, StoredSession } from './session.types';
import { InstitutionApprovalStatus } from '../../institution/enums/institution-approval-status.enum';

interface SessionPolicy {
  idleTtlMs: number;
  absoluteTtlMs: number;
}

const CREATE_SESSION_SCRIPT = `
redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2])
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', ARGV[3])
redis.call('ZADD', KEYS[2], ARGV[4], ARGV[5])

local currentTtl = redis.call('PTTL', KEYS[2])
if currentTtl < tonumber(ARGV[6]) then
  redis.call('PEXPIRE', KEYS[2], ARGV[6])
end

local count = redis.call('ZCARD', KEYS[2])
local excess = count - tonumber(ARGV[7])
if excess > 0 then
  local evicted = redis.call('ZPOPMIN', KEYS[2], excess)
  for index = 1, #evicted, 2 do
    redis.call('DEL', ARGV[8] .. evicted[index])
  end
end
return 1
`;

const REVOKE_SESSION_SCRIPT = `
local removed = redis.call('DEL', KEYS[1])
redis.call('ZREM', KEYS[2], ARGV[1])
if redis.call('ZCARD', KEYS[2]) == 0 then
  redis.call('DEL', KEYS[2])
end
return removed
`;

const REVOKE_ALL_SCRIPT = `
local hashes = redis.call('ZRANGE', KEYS[1], 0, -1)
for _, hash in ipairs(hashes) do
  redis.call('DEL', ARGV[1] .. hash)
end
redis.call('DEL', KEYS[1])
return #hashes
`;

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private readonly refreshIntervalMs: number;
  private readonly maxSessionsPerUser: number;

  constructor(
    private readonly redis: RedisService,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
    private readonly metrics: AuthMetricsService
  ) {
    this.refreshIntervalMs = this.seconds('SESSION_REFRESH_INTERVAL_SECONDS', 60) * 1000;
    this.maxSessionsPerUser = this.number('SESSION_MAX_PER_USER', 5);
  }

  async create(
    user: User,
    rememberMe = false,
    authenticationLevel: 'mfa' | 'password' = 'password'
  ): Promise<CreatedSession> {
    if (
      (user.role === UserRoles.Administrador || user.isPlatformAdmin) &&
      authenticationLevel !== 'mfa'
    )
      throw new ForbiddenException('La sesión administrativa requiere segundo factor.');
    const sessionToken = randomBytes(32).toString('base64url');
    const hash = this.hash(sessionToken);
    const now = Date.now();
    const policy = this.policy(user.role, rememberMe);
    const session: StoredSession = {
      authenticationLevel,
      userId: user.id,
      createdAt: now,
      lastActivityAt: now,
      absoluteExpiresAt: now + policy.absoluteTtlMs,
      rememberMe,
      authVersion: user.authVersion ?? 1,
    };

    try {
      await this.redis.client.eval(CREATE_SESSION_SCRIPT, {
        keys: [this.sessionKey(hash), this.userIndexKey(user.id)],
        arguments: [
          JSON.stringify(session),
          String(this.effectiveTtl(session, policy, now)),
          String(now),
          String(session.absoluteExpiresAt),
          hash,
          String(policy.absoluteTtlMs),
          String(this.maxSessionsPerUser),
          'session:',
        ],
      });
    } catch (error) {
      this.metrics.increment('auth_redis_error_total');
      this.logger.error('Redis falló al crear una sesión.', (error as Error).stack);
      throw new ServiceUnavailableException('El servicio de sesiones no está disponible.');
    }

    this.metrics.increment('auth_session_created_total');
    this.logger.log(`Sesión creada (${hash.slice(0, 12)}) para el usuario ${user.id}.`);
    return {
      sessionToken,
      expiresAt: new Date(session.absoluteExpiresAt).toISOString(),
    };
  }

  async validate(sessionToken: string): Promise<{ user: User; session: StoredSession } | null> {
    const startedAt = performance.now();
    try {
      return await this.validateInternal(sessionToken);
    } finally {
      this.metrics.observeValidation(performance.now() - startedAt);
    }
  }

  private async validateInternal(
    sessionToken: string
  ): Promise<{ user: User; session: StoredSession } | null> {
    const hash = this.hash(sessionToken);
    let session: StoredSession | undefined;

    try {
      const stored = await this.redis.client.get(this.sessionKey(hash));
      session = stored ? (JSON.parse(stored) as StoredSession) : undefined;
    } catch (error) {
      this.metrics.increment('auth_redis_error_total');
      this.logger.error('Redis falló al validar una sesión.', (error as Error).stack);
      throw new ServiceUnavailableException('El servicio de sesiones no está disponible.');
    }

    if (!session) {
      this.metrics.increment('auth_session_invalid_total');
      this.logger.warn(`Sesión no encontrada (${hash.slice(0, 12)}).`);
      return null;
    }

    const now = Date.now();
    const user = await this.userRepository.findOne({
      where: { id: session.userId },
      relations: ['institution'],
    });
    if (
      !user ||
      !user.isActive ||
      user.approvalStatus !== InstitutionApprovalStatus.APPROVED ||
      !user.institution?.isActive ||
      user.authVersion !== session.authVersion ||
      ((user.role === UserRoles.Administrador || user.isPlatformAdmin) &&
        session.authenticationLevel !== 'mfa') ||
      now >= session.absoluteExpiresAt
    ) {
      await this.revokeByHash(hash, session.userId);
      this.metrics.increment('auth_session_invalid_total');
      this.logger.warn(`Sesión invalidada (${hash.slice(0, 12)}).`);
      return null;
    }

    const policy = this.policy(user.role, session.rememberMe);
    if (now - session.lastActivityAt >= policy.idleTtlMs) {
      await this.revokeByHash(hash, session.userId);
      this.metrics.increment('auth_session_invalid_total');
      this.logger.warn(`Sesión expirada por inactividad (${hash.slice(0, 12)}).`);
      return null;
    }

    if (now - session.lastActivityAt >= this.refreshIntervalMs) {
      session.lastActivityAt = now;
      try {
        await this.redis.client.set(this.sessionKey(hash), JSON.stringify(session), {
          PX: this.effectiveTtl(session, policy, now),
        });
      } catch (error) {
        this.metrics.increment('auth_redis_error_total');
        this.logger.error('Redis falló al renovar una sesión.', (error as Error).stack);
        throw new ServiceUnavailableException('El servicio de sesiones no está disponible.');
      }
    }

    delete user.password;
    return { user, session };
  }

  async revoke(sessionToken: string): Promise<boolean> {
    const hash = this.hash(sessionToken);
    try {
      const stored = await this.redis.client.get(this.sessionKey(hash));
      const session = stored ? (JSON.parse(stored) as StoredSession) : undefined;
      if (!session) return false;
      await this.revokeByHash(hash, session.userId);
      this.metrics.increment('auth_session_revoked_total');
      this.logger.log(`Sesión revocada (${hash.slice(0, 12)}) para el usuario ${session.userId}.`);
      return true;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      this.metrics.increment('auth_redis_error_total');
      this.logger.error('Redis falló al revocar una sesión.', (error as Error).stack);
      throw new ServiceUnavailableException('El servicio de sesiones no está disponible.');
    }
  }

  async revokeAll(userId: string): Promise<number> {
    try {
      const revoked = await this.redis.client.eval(REVOKE_ALL_SCRIPT, {
        keys: [this.userIndexKey(userId)],
        arguments: ['session:'],
      });
      this.metrics.increment('auth_session_revoked_total', Number(revoked));
      return Number(revoked);
    } catch (error) {
      this.metrics.increment('auth_redis_error_total');
      this.logger.error('Redis falló al revocar todas las sesiones.', (error as Error).stack);
      throw new ServiceUnavailableException('El servicio de sesiones no está disponible.');
    }
  }

  private async revokeByHash(hash: string, userId: string): Promise<void> {
    try {
      await this.redis.client.eval(REVOKE_SESSION_SCRIPT, {
        keys: [this.sessionKey(hash), this.userIndexKey(userId)],
        arguments: [hash],
      });
    } catch (error) {
      this.metrics.increment('auth_redis_error_total');
      this.logger.error('Redis falló al eliminar una sesión.', (error as Error).stack);
      throw new ServiceUnavailableException('El servicio de sesiones no está disponible.');
    }
  }

  private policy(role: UserRoles, rememberMe: boolean): SessionPolicy {
    if (role === UserRoles.Administrador) {
      return {
        idleTtlMs: this.seconds('SESSION_ADMIN_IDLE_SECONDS', 15 * 60) * 1000,
        absoluteTtlMs: this.seconds('SESSION_ADMIN_ABSOLUTE_SECONDS', 4 * 60 * 60) * 1000,
      };
    }
    if (rememberMe) {
      return {
        idleTtlMs: this.seconds('SESSION_REMEMBER_IDLE_SECONDS', 7 * 24 * 60 * 60) * 1000,
        absoluteTtlMs: this.seconds('SESSION_REMEMBER_ABSOLUTE_SECONDS', 30 * 24 * 60 * 60) * 1000,
      };
    }
    return {
      idleTtlMs: this.seconds('SESSION_IDLE_SECONDS', 30 * 60) * 1000,
      absoluteTtlMs: this.seconds('SESSION_ABSOLUTE_SECONDS', 8 * 60 * 60) * 1000,
    };
  }

  private effectiveTtl(session: StoredSession, policy: SessionPolicy, now: number): number {
    return Math.max(1, Math.min(policy.idleTtlMs, session.absoluteExpiresAt - now));
  }

  private seconds(key: string, fallback: number): number {
    return this.number(key, fallback);
  }

  private number(key: string, fallback: number): number {
    const value = Number(this.configService.get(key));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private sessionKey(hash: string): string {
    return `session:${hash}`;
  }

  private userIndexKey(userId: string): string {
    return `user-sessions:${userId}`;
  }
}
