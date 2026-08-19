import { UnauthorizedException } from '@nestjs/common';
import { TwoFactorService } from 'src/auth/two-factor';
import { UserRoles } from 'src/auth/enums';
import { InstitutionApprovalStatus } from 'src/institution';
import { User } from 'src/user/entities/user.entity';

describe('TwoFactorService', () => {
  const user = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'admin@example.com',
    role: UserRoles.Administrador,
    isPlatformAdmin: false,
    isActive: true,
    approvalStatus: InstitutionApprovalStatus.APPROVED,
    authVersion: 1,
    institution: { isActive: true },
    twoFactorEnabledAt: null,
    twoFactorSecretEncrypted: null,
    twoFactorLastCounter: null,
  } as User;
  const redis = {
    client: {
      eval: jest.fn(),
      get: jest.fn(),
    },
  };
  const userRepository = { findOne: jest.fn() };
  const lockedUser = { ...user };
  const save = jest.fn();
  const queryBuilder = {
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
  };
  const dataSource = {
    transaction: jest.fn(async (callback) =>
      callback({
        getRepository: () => ({ createQueryBuilder: () => queryBuilder, save }),
      })
    ),
  };
  const config = {
    get: jest.fn((name: string, fallback?: unknown) => {
      const values: Record<string, unknown> = {
        APP_NAME: 'Aura Grade',
        AUTH_2FA_CHALLENGE_TTL_SECONDS: 300,
        AUTH_2FA_ENCRYPTION_KEY: 'test-encryption-key-with-at-least-32-characters',
        AUTH_2FA_MAX_ATTEMPTS: 5,
      };
      return values[name] ?? fallback;
    }),
  };
  const metrics = { increment: jest.fn() };
  let service: TwoFactorService;

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    Object.assign(lockedUser, {
      ...user,
      twoFactorEnabledAt: null,
      twoFactorSecretEncrypted: null,
      twoFactorLastCounter: null,
    });
    userRepository.findOne.mockResolvedValue({ ...user });
    queryBuilder.getOne.mockResolvedValue(lockedUser);
    save.mockImplementation(async (value) => value);
    redis.client.eval.mockResolvedValue(1);
    service = new TwoFactorService(
      redis as never,
      userRepository as never,
      dataSource as never,
      config as never,
      metrics as never
    );
  });

  it('creates an opaque setup challenge without storing the plaintext TOTP secret', async () => {
    const challenge = await service.createChallenge(user, true);
    const evalArguments = redis.client.eval.mock.calls[0][1];
    const stored = JSON.parse(evalArguments.arguments[1]);

    expect(challenge.requiresTwoFactorSetup).toBe(true);
    expect(challenge.setupKey).toMatch(/^[A-Z2-7]{32}$/);
    expect(challenge.otpAuthUri).toContain('otpauth://totp/');
    expect(stored.secretEncrypted).toMatch(/^v1:/);
    expect(stored.secretEncrypted).not.toContain(challenge.setupKey);
    expect(stored.authVersion).toBe(1);
    expect(evalArguments.keys[0]).not.toContain(challenge.challengeToken);
  });

  it.each([UserRoles.Administrador, UserRoles.Docente, UserRoles.Estudiante])(
    'requires OTP for the %s role',
    (role) => {
      expect(service.requiresTwoFactor({ ...user, role })).toBe(true);
    }
  );

  it('accepts a current TOTP once and persists encrypted enrollment state', async () => {
    const now = 1_787_123_450_000;
    jest.spyOn(Date, 'now').mockReturnValue(now);
    const secret = (service as any).base32(Buffer.alloc(20, 7));
    const secretEncrypted = (service as any).encrypt(secret);
    const challenge = JSON.stringify({
      attempts: 0,
      authVersion: 1,
      rememberMe: true,
      secretEncrypted,
      setup: true,
      userId: user.id,
    });
    const counter = BigInt(Math.floor(now / 30_000));
    const otp = (service as any).totp(secret, counter);
    redis.client.get.mockResolvedValue(challenge);
    redis.client.eval.mockResolvedValue(challenge);

    const result = await service.verifyChallenge(
      'challenge-token-with-more-than-32-characters',
      otp
    );

    expect(result.rememberMe).toBe(true);
    expect(lockedUser.twoFactorSecretEncrypted).toBe(secretEncrypted);
    expect(lockedUser.twoFactorEnabledAt).toBeInstanceOf(Date);
    expect(lockedUser.twoFactorLastCounter).toBe(counter.toString());
    expect(save).toHaveBeenCalledWith(lockedUser);
  });

  it('counts an invalid OTP attempt and does not persist enrollment', async () => {
    const now = 1_787_123_450_000;
    jest.spyOn(Date, 'now').mockReturnValue(now);
    const secret = (service as any).base32(Buffer.alloc(20, 9));
    const challenge = JSON.stringify({
      attempts: 0,
      authVersion: 1,
      rememberMe: false,
      secretEncrypted: (service as any).encrypt(secret),
      setup: true,
      userId: user.id,
    });
    redis.client.get.mockResolvedValue(challenge);
    const validOtp = (service as any).totp(secret, BigInt(Math.floor(now / 30_000)));
    const invalidOtp = `${validOtp.slice(0, 5)}${validOtp.endsWith('0') ? '1' : '0'}`;

    await expect(
      service.verifyChallenge('challenge-token-with-more-than-32-characters', invalidOtp)
    ).rejects.toThrow(UnauthorizedException);
    expect(redis.client.eval).toHaveBeenCalledTimes(1);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects a TOTP counter that was already used', async () => {
    const now = 1_787_123_450_000;
    jest.spyOn(Date, 'now').mockReturnValue(now);
    const secret = (service as any).base32(Buffer.alloc(20, 11));
    const secretEncrypted = (service as any).encrypt(secret);
    const counter = BigInt(Math.floor(now / 30_000));
    const challenge = JSON.stringify({
      attempts: 0,
      authVersion: 1,
      rememberMe: false,
      secretEncrypted,
      setup: false,
      userId: user.id,
    });
    userRepository.findOne.mockResolvedValue({
      ...user,
      twoFactorEnabledAt: new Date(),
    });
    Object.assign(lockedUser, {
      twoFactorEnabledAt: new Date(),
      twoFactorSecretEncrypted: secretEncrypted,
      twoFactorLastCounter: counter.toString(),
    });
    redis.client.get.mockResolvedValue(challenge);
    redis.client.eval.mockResolvedValue(challenge);
    const otp = (service as any).totp(secret, counter);

    await expect(
      service.verifyChallenge('challenge-token-with-more-than-32-characters', otp)
    ).rejects.toThrow('Este código ya fue utilizado.');
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects a challenge issued before the password or sessions were invalidated', async () => {
    const challenge = JSON.stringify({
      attempts: 0,
      authVersion: 1,
      rememberMe: false,
      secretEncrypted: (service as any).encrypt((service as any).base32(Buffer.alloc(20, 13))),
      setup: true,
      userId: user.id,
    });
    userRepository.findOne.mockResolvedValue({ ...user, authVersion: 2 });
    redis.client.get.mockResolvedValue(challenge);

    await expect(
      service.verifyChallenge('challenge-token-with-more-than-32-characters', '123456')
    ).rejects.toThrow('La cuenta no puede completar el segundo factor.');
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});
