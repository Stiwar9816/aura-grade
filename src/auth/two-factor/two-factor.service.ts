import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { InstitutionApprovalStatus } from 'src/institution';
import { AuthMetricsService } from 'src/observability';
import { RedisService } from 'src/redis';
import { User } from 'src/user/entities/user.entity';
import { UserRoles } from '../enums';

type StoredChallenge = {
  attempts: number;
  authVersion: number;
  rememberMe: boolean;
  secretEncrypted: string;
  setup: boolean;
  userId: string;
};

export type TwoFactorChallenge = {
  challengeToken: string;
  expiresAt: string;
  otpAuthUri?: string;
  requiresTwoFactor: true;
  requiresTwoFactorSetup: boolean;
  setupKey?: string;
};

const CREATE_CHALLENGE_SCRIPT = `
local previous = redis.call('GET', KEYS[2])
if previous then redis.call('DEL', ARGV[1] .. previous) end
redis.call('SET', KEYS[1], ARGV[2], 'PX', ARGV[3])
redis.call('SET', KEYS[2], ARGV[4], 'PX', ARGV[3])
return 1
`;

const INVALID_ATTEMPT_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return -1 end
local challenge = cjson.decode(raw)
challenge.attempts = (tonumber(challenge.attempts) or 0) + 1
if challenge.attempts >= tonumber(ARGV[1]) then
  redis.call('DEL', KEYS[1])
  redis.call('DEL', KEYS[2])
  return challenge.attempts
end
redis.call('SET', KEYS[1], cjson.encode(challenge), 'KEEPTTL')
return challenge.attempts
`;

const CONSUME_CHALLENGE_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return nil end
redis.call('DEL', KEYS[1])
local current = redis.call('GET', KEYS[2])
if current == ARGV[1] then redis.call('DEL', KEYS[2]) end
return raw
`;

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

@Injectable()
export class TwoFactorService {
  private readonly challengeTtlMs: number;
  private readonly maxAttempts: number;
  private readonly encryptionKey: Buffer;

  constructor(
    private readonly redis: RedisService,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly metrics: AuthMetricsService
  ) {
    this.challengeTtlMs = this.positiveInteger('AUTH_2FA_CHALLENGE_TTL_SECONDS', 300) * 1000;
    this.maxAttempts = this.positiveInteger('AUTH_2FA_MAX_ATTEMPTS', 5);
    const configuredKey =
      this.configService.get<string>('AUTH_2FA_ENCRYPTION_KEY') ||
      this.configService.get<string>('JWT_SECRET');
    if (!configuredKey)
      throw new Error(
        'AUTH_2FA_ENCRYPTION_KEY no está configurado para proteger los secretos TOTP.'
      );
    this.encryptionKey = createHash('sha256').update(configuredKey).digest();
  }

  requiresTwoFactor(user: Pick<User, 'isPlatformAdmin' | 'role'>): boolean {
    return user.isPlatformAdmin || Object.values(UserRoles).includes(user.role);
  }

  async createChallenge(user: User, rememberMe: boolean): Promise<TwoFactorChallenge> {
    const setup = !user.twoFactorEnabledAt || !user.twoFactorSecretEncrypted;
    const secret = setup
      ? this.base32(randomBytes(20))
      : this.decrypt(user.twoFactorSecretEncrypted!);
    const secretEncrypted = setup ? this.encrypt(secret) : user.twoFactorSecretEncrypted!;
    const challengeToken = randomBytes(32).toString('base64url');
    const challengeHash = this.hash(challengeToken);
    const challenge: StoredChallenge = {
      attempts: 0,
      authVersion: user.authVersion ?? 1,
      rememberMe,
      secretEncrypted,
      setup,
      userId: user.id,
    };

    try {
      await this.redis.client.eval(CREATE_CHALLENGE_SCRIPT, {
        keys: [this.challengeKey(challengeHash), this.userChallengeKey(user.id)],
        arguments: [
          'auth-2fa-challenge:',
          JSON.stringify(challenge),
          String(this.challengeTtlMs),
          challengeHash,
        ],
      });
    } catch {
      this.metrics.increment('auth_redis_error_total');
      throw new ServiceUnavailableException('El servicio de segundo factor no está disponible.');
    }

    const response: TwoFactorChallenge = {
      challengeToken,
      expiresAt: new Date(Date.now() + this.challengeTtlMs).toISOString(),
      requiresTwoFactor: true,
      requiresTwoFactorSetup: setup,
    };
    if (setup) {
      response.setupKey = secret;
      response.otpAuthUri = this.otpAuthUri(user.email, secret);
    }
    return response;
  }

  async verifyChallenge(
    challengeToken: string,
    otp: string
  ): Promise<{ rememberMe: boolean; user: User }> {
    const challengeHash = this.hash(challengeToken);
    const challenge = await this.getChallenge(challengeHash);
    const user = await this.userRepository.findOne({
      where: { id: challenge.userId },
      relations: ['courses', 'assignments', 'institution'],
    });
    if (
      !user ||
      !user.isActive ||
      user.approvalStatus !== InstitutionApprovalStatus.APPROVED ||
      !user.institution?.isActive ||
      user.authVersion !== challenge.authVersion ||
      !this.requiresTwoFactor(user)
    )
      throw new ForbiddenException('La cuenta no puede completar el segundo factor.');

    const counter = this.matchingCounter(this.decrypt(challenge.secretEncrypted), otp);
    if (counter === null) {
      await this.registerInvalidAttempt(challengeHash, challenge.userId);
      this.metrics.increment('auth_otp_failure_total');
      throw new UnauthorizedException('Código inválido o expirado.');
    }

    const consumed = await this.consume(challengeHash, challenge.userId);
    if (!consumed) throw new UnauthorizedException('Código inválido o expirado.');

    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(User);
      const locked = await repository
        .createQueryBuilder('user')
        .addSelect(['user.twoFactorSecretEncrypted', 'user.twoFactorLastCounter'])
        .where('user.id = :userId', { userId: challenge.userId })
        .setLock('pessimistic_write')
        .getOne();
      if (!locked || !locked.isActive)
        throw new UnauthorizedException('Código inválido o expirado.');
      const lastCounter = locked.twoFactorLastCounter
        ? BigInt(locked.twoFactorLastCounter)
        : undefined;
      if (lastCounter !== undefined && counter <= lastCounter)
        throw new UnauthorizedException('Este código ya fue utilizado.');
      if (challenge.setup) {
        if (locked.twoFactorEnabledAt || locked.twoFactorSecretEncrypted)
          throw new UnauthorizedException('El segundo factor ya fue configurado.');
        locked.twoFactorSecretEncrypted = challenge.secretEncrypted;
        locked.twoFactorEnabledAt = new Date();
      } else if (locked.twoFactorSecretEncrypted !== challenge.secretEncrypted) {
        throw new UnauthorizedException('La configuración del segundo factor cambió.');
      }
      locked.twoFactorLastCounter = counter.toString();
      await repository.save(locked);
    });

    this.metrics.increment('auth_otp_success_total');
    delete user.password;
    delete user.twoFactorSecretEncrypted;
    delete user.twoFactorLastCounter;
    return { rememberMe: challenge.rememberMe, user };
  }

  private async getChallenge(hash: string): Promise<StoredChallenge> {
    try {
      const raw = await this.redis.client.get(this.challengeKey(hash));
      if (!raw) throw new UnauthorizedException('Código inválido o expirado.');
      return JSON.parse(raw) as StoredChallenge;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      this.metrics.increment('auth_redis_error_total');
      throw new ServiceUnavailableException('El servicio de segundo factor no está disponible.');
    }
  }

  private async registerInvalidAttempt(hash: string, userId: string): Promise<void> {
    try {
      await this.redis.client.eval(INVALID_ATTEMPT_SCRIPT, {
        keys: [this.challengeKey(hash), this.userChallengeKey(userId)],
        arguments: [String(this.maxAttempts)],
      });
    } catch {
      this.metrics.increment('auth_redis_error_total');
      throw new ServiceUnavailableException('El servicio de segundo factor no está disponible.');
    }
  }

  private async consume(hash: string, userId: string): Promise<boolean> {
    try {
      const raw = await this.redis.client.eval(CONSUME_CHALLENGE_SCRIPT, {
        keys: [this.challengeKey(hash), this.userChallengeKey(userId)],
        arguments: [hash],
      });
      return typeof raw === 'string';
    } catch {
      this.metrics.increment('auth_redis_error_total');
      throw new ServiceUnavailableException('El servicio de segundo factor no está disponible.');
    }
  }

  private matchingCounter(secret: string, submittedCode: string): bigint | null {
    if (!/^\d{6}$/.test(submittedCode)) return null;
    const current = BigInt(Math.floor(Date.now() / 30_000));
    for (const offset of [-1n, 0n, 1n]) {
      const counter = current + offset;
      const expected = this.totp(secret, counter);
      if (timingSafeEqual(Buffer.from(expected), Buffer.from(submittedCode))) return counter;
    }
    return null;
  }

  private totp(secret: string, counter: bigint): string {
    const counterBytes = Buffer.alloc(8);
    counterBytes.writeBigUInt64BE(counter);
    const digest = createHmac('sha1', this.fromBase32(secret)).update(counterBytes).digest();
    const offset = digest[digest.length - 1] & 0x0f;
    const value =
      (((digest[offset] & 0x7f) << 24) |
        ((digest[offset + 1] & 0xff) << 16) |
        ((digest[offset + 2] & 0xff) << 8) |
        (digest[offset + 3] & 0xff)) %
      1_000_000;
    return value.toString().padStart(6, '0');
  }

  private otpAuthUri(email: string, secret: string): string {
    const issuer = this.configService.get<string>('APP_NAME') || 'Aura Grade';
    const label = encodeURIComponent(`${issuer}:${email}`);
    return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&digits=6&period=30`;
  }

  private encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return [
      'v1',
      iv.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      encrypted.toString('base64url'),
    ].join(':');
  }

  private decrypt(value: string): string {
    const [version, ivValue, tagValue, encryptedValue, extra] = value.split(':');
    if (version !== 'v1' || extra !== undefined || !ivValue || !tagValue || !encryptedValue)
      throw new UnauthorizedException('La configuración del segundo factor no es válida.');
    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.encryptionKey,
        Buffer.from(ivValue, 'base64url')
      );
      decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(encryptedValue, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new UnauthorizedException('La configuración del segundo factor no es válida.');
    }
  }

  private base32(input: Buffer): string {
    let bits = 0;
    let value = 0;
    let output = '';
    for (const byte of input) {
      value = (value << 8) | byte;
      bits += 8;
      while (bits >= 5) {
        output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }
    if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    return output;
  }

  private fromBase32(value: string): Buffer {
    let bits = 0;
    let accumulator = 0;
    const bytes: number[] = [];
    for (const character of value.replace(/=+$/, '').toUpperCase()) {
      const index = BASE32_ALPHABET.indexOf(character);
      if (index < 0) throw new UnauthorizedException('El secreto TOTP no es válido.');
      accumulator = (accumulator << 5) | index;
      bits += 5;
      if (bits >= 8) {
        bytes.push((accumulator >>> (bits - 8)) & 0xff);
        bits -= 8;
      }
    }
    return Buffer.from(bytes);
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private challengeKey(hash: string): string {
    return `auth-2fa-challenge:${hash}`;
  }

  private userChallengeKey(userId: string): string {
    return `auth-2fa-user:${userId}`;
  }

  private positiveInteger(name: string, fallback: number): number {
    const raw = Number(this.configService.get(name, fallback));
    return Number.isInteger(raw) && raw > 0 ? raw : fallback;
  }
}
