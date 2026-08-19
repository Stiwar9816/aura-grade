import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthService } from 'src/auth/auth.service';
import { User } from 'src/user/entities/user.entity';
import { MailService } from 'src/mail/mail.service';
import { CreateUserDto, LoginUserDto } from 'src/auth/dto';
import { DocumentType, UserRoles } from 'src/auth/enums';
import { SessionService } from 'src/auth/session';
import { AuthAttemptService } from 'src/auth/security';
import { PasswordService } from 'src/auth/security';
import { TwoFactorService } from 'src/auth/two-factor';
import { AuthMetricsService } from 'src/observability';
import { InstitutionApprovalStatus, InstitutionService } from 'src/institution';

describe('AuthService', () => {
  const institutionId = 'f1d24f6e-b766-4e3f-a1c9-4d4c0a58ad31';
  const mockInstitution = {
    id: institutionId,
    name: 'Universidad Aura',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  let service: AuthService;

  const mockUser: User = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'John',
    last_name: 'Doe',
    document_type: DocumentType.CITIZENSHIP_CARD,
    document_num: 123456789,
    phone: 3001234567,
    email: 'john.doe@example.com',
    password: 'hashedPassword123',
    isActive: true,
    role: UserRoles.Estudiante,
    approvalStatus: InstitutionApprovalStatus.APPROVED,
    institutionId,
    institution: mockInstitution,
    authVersion: 1,
    isPlatformAdmin: false,
    checkFieldsBeforeInsert: jest.fn(),
    checkFieldsBeforeUpdate: jest.fn(),
  };

  const mockAuthRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    increment: jest.fn(),
    update: jest.fn(),
  };

  const mockMailService = {
    sendUserConfirmation: jest.fn(),
    sendResetPassword: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  const mockSessionService = {
    create: jest.fn(),
    isCurrent: jest.fn(),
    list: jest.fn(),
    revoke: jest.fn(),
    revokeAll: jest.fn(),
    revokeOwned: jest.fn(),
  };
  const mockAuthAttempts = {
    registerFailure: jest.fn(),
    clear: jest.fn(),
  };
  const mockPasswordService = {
    hash: jest.fn(),
    verify: jest.fn(),
    needsRehash: jest.fn(),
  };
  const mockTwoFactorService = {
    requiresTwoFactor: jest.fn(),
    createChallenge: jest.fn(),
    verifyChallenge: jest.fn(),
  };
  const mockMetrics = {
    increment: jest.fn(),
  };
  const mockInstitutionService = {
    findActiveById: jest.fn(),
  };

  const mockPayload = () => ({
    id: mockUser.id,
    email: mockUser.email,
    name: mockUser.name,
    last_name: mockUser.last_name,
    role: mockUser.role,
    phone: mockUser.phone,
    document_num: mockUser.document_num,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockAuthRepository,
        },
        {
          provide: MailService,
          useValue: mockMailService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: SessionService,
          useValue: mockSessionService,
        },
        {
          provide: AuthAttemptService,
          useValue: mockAuthAttempts,
        },
        {
          provide: AuthMetricsService,
          useValue: mockMetrics,
        },
        {
          provide: InstitutionService,
          useValue: mockInstitutionService,
        },
        {
          provide: PasswordService,
          useValue: mockPasswordService,
        },
        {
          provide: TwoFactorService,
          useValue: mockTwoFactorService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);

    jest.clearAllMocks();
    mockInstitutionService.findActiveById.mockResolvedValue(mockInstitution);
    mockPasswordService.hash.mockResolvedValue('scrypt-hash');
    mockPasswordService.verify.mockResolvedValue(true);
    mockPasswordService.needsRehash.mockReturnValue(false);
    mockTwoFactorService.requiresTwoFactor.mockReturnValue(false);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getToken', () => {
    it('should generate a JWT token', () => {
      const payload = mockPayload();
      const token = 'mock-jwt-token';
      mockJwtService.sign.mockReturnValue(token);

      const result = service.getToken(payload);

      expect(mockJwtService.sign).toHaveBeenCalledWith(payload);
      expect(result).toBe(token);
    });
  });

  describe('register', () => {
    it('should create a pending user without creating a session', async () => {
      const createUserDto: CreateUserDto = {
        name: 'John',
        last_name: 'Doe',
        document_type: DocumentType.CITIZENSHIP_CARD,
        document_num: 123456789,
        phone: 3001234567,
        email: 'john.doe@example.com',
        password: 'Password123',
        role: UserRoles.Estudiante,
        institutionId,
      };

      const hashedPassword = 'hashedPassword123';
      mockPasswordService.hash.mockResolvedValue(hashedPassword);

      const createdUser = { ...mockUser, password: hashedPassword };
      mockAuthRepository.create.mockReturnValue(createdUser);
      mockAuthRepository.save.mockResolvedValue(createdUser);
      mockMailService.sendUserConfirmation.mockResolvedValue(true);
      const result = await service.register(createUserDto);

      expect(mockAuthRepository.create).toHaveBeenCalledWith({
        name: createUserDto.name,
        last_name: createUserDto.last_name,
        document_type: createUserDto.document_type,
        document_num: createUserDto.document_num,
        phone: createUserDto.phone,
        email: createUserDto.email,
        role: UserRoles.Estudiante,
        institutionId,
        institution: mockInstitution,
        approvalStatus: InstitutionApprovalStatus.PENDING,
        password: hashedPassword,
      });
      expect(mockAuthRepository.save).toHaveBeenCalled();
      expect(mockMailService.sendUserConfirmation).toHaveBeenCalledWith(
        createdUser,
        createUserDto.password
      );
      expect(mockInstitutionService.findActiveById).toHaveBeenCalledWith(institutionId);
      expect(mockSessionService.create).not.toHaveBeenCalled();
      expect(result.pendingApproval).toBe(true);
      expect(result).not.toHaveProperty('sessionToken');
      expect(result.user.password).toBeUndefined();
    });

    it('should not send a confirmation email when persistence fails', async () => {
      const createUserDto: CreateUserDto = {
        name: 'John',
        last_name: 'Doe',
        document_type: DocumentType.CITIZENSHIP_CARD,
        document_num: 123456789,
        phone: 3001234567,
        email: 'john.doe@example.com',
        password: 'Password123',
        role: UserRoles.Estudiante,
        institutionId,
      };

      mockAuthRepository.create.mockReturnValue(mockUser);
      mockAuthRepository.save.mockRejectedValue({
        code: '23505',
        detail: 'Key (email)=(john.doe@example.com) already exists.',
      });

      await expect(service.register(createUserDto)).rejects.toThrow(BadRequestException);
      expect(mockMailService.sendUserConfirmation).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException on duplicate email', async () => {
      const createUserDto: CreateUserDto = {
        name: 'John',
        last_name: 'Doe',
        document_type: DocumentType.CITIZENSHIP_CARD,
        document_num: 123456789,
        phone: 3001234567,
        email: 'john.doe@example.com',
        password: 'Password123',
        role: UserRoles.Estudiante,
        institutionId,
      };

      mockAuthRepository.create.mockReturnValue(mockUser);
      mockAuthRepository.save.mockRejectedValue({
        code: '23505',
        detail: 'Key (email)=(john.doe@example.com) already exists.',
      });

      await expect(service.register(createUserDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw InternalServerErrorException for unexpected errors', async () => {
      const createUserDto: CreateUserDto = {
        name: 'John',
        last_name: 'Doe',
        document_type: DocumentType.CITIZENSHIP_CARD,
        document_num: 123456789,
        phone: 3001234567,
        email: 'john.doe@example.com',
        password: 'Password123',
        role: UserRoles.Estudiante,
        institutionId,
      };

      mockAuthRepository.create.mockReturnValue(mockUser);
      mockAuthRepository.save.mockRejectedValue({
        code: 'UNKNOWN_ERROR',
        detail: 'Some unexpected error',
      });

      await expect(service.register(createUserDto)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('forgotPassword', () => {
    it('should send a temporary password before persisting it', async () => {
      const user = { ...mockUser, password: 'previous-password', authVersion: 1 };
      mockAuthRepository.findOne.mockResolvedValue(user);
      mockMailService.sendResetPassword.mockResolvedValue(true);
      mockAuthRepository.save.mockResolvedValue(user);

      const result = await service.forgotPassword(' JOHN.DOE@EXAMPLE.COM ');

      expect(mockAuthRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'john.doe@example.com' },
      });
      expect(mockMailService.sendResetPassword).toHaveBeenCalledWith(user, expect.any(String));
      expect(mockAuthRepository.save).toHaveBeenCalledWith(user);
      expect(user.authVersion).toBe(2);
      expect(result).toBe(user);
    });

    it('should not persist a new password when email delivery fails', async () => {
      mockAuthRepository.findOne.mockResolvedValue({ ...mockUser });
      mockMailService.sendResetPassword.mockRejectedValue(new Error('Email delivery failed'));

      await expect(service.forgotPassword(mockUser.email)).rejects.toThrow('Email delivery failed');
      expect(mockAuthRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should login user and return user with token', async () => {
      const loginUserDto: LoginUserDto = {
        email: 'john.doe@example.com',
        password: 'Password123',
      };

      const userWithPassword = { ...mockUser, password: bcrypt.hashSync('Password123', 12) };
      mockAuthRepository.findOne.mockResolvedValue(userWithPassword);
      mockSessionService.create.mockResolvedValue({
        sessionToken: 'opaque-token',
        expiresAt: '2026-07-26T00:00:00.000Z',
      });

      const result = await service.login(loginUserDto);

      expect(mockAuthRepository.findOne).toHaveBeenCalledWith({
        where: { email: loginUserDto.email },
        select: {
          id: true,
          name: true,
          last_name: true,
          document_num: true,
          password: true,
          phone: true,
          email: true,
          role: true,
          approvalStatus: true,
          institutionId: true,
          document_type: true,
          isActive: true,
          authVersion: true,
          isPlatformAdmin: true,
          twoFactorSecretEncrypted: true,
          twoFactorEnabledAt: true,
          twoFactorLastCounter: true,
        },
        relations: ['courses', 'assignments', 'institution'],
      });
      expect(result).not.toHaveProperty('token');
      expect(result).toHaveProperty('sessionToken', 'opaque-token');
      expect('user' in result && result.user.password).toBeUndefined();
    });

    it('should throw UnauthorizedException if user not found', async () => {
      const loginUserDto: LoginUserDto = {
        email: 'nonexistent@example.com',
        password: 'Password123',
      };

      mockAuthRepository.findOne.mockResolvedValue(null);

      await expect(service.login(loginUserDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if email does not match', async () => {
      const loginUserDto: LoginUserDto = {
        email: 'john.doe@example.com',
        password: 'Password123',
      };

      const userWithDifferentEmail = { ...mockUser, email: 'different@example.com' };
      mockAuthRepository.findOne.mockResolvedValue(userWithDifferentEmail);

      await expect(service.login(loginUserDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password does not match', async () => {
      const loginUserDto: LoginUserDto = {
        email: 'john.doe@example.com',
        password: 'WrongPassword',
      };

      const userWithPassword = { ...mockUser, password: bcrypt.hashSync('Password123', 12) };
      mockAuthRepository.findOne.mockResolvedValue(userWithPassword);
      mockPasswordService.verify.mockResolvedValue(false);

      await expect(service.login(loginUserDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user is inactive', async () => {
      const loginUserDto: LoginUserDto = {
        email: 'john.doe@example.com',
        password: 'Password123',
      };

      const inactiveUser = {
        ...mockUser,
        isActive: false,
        password: bcrypt.hashSync('Password123', 12),
      };
      mockAuthRepository.findOne.mockResolvedValue(inactiveUser);

      await expect(service.login(loginUserDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should reject login while institutional approval is pending', async () => {
      const pendingUser = {
        ...mockUser,
        approvalStatus: InstitutionApprovalStatus.PENDING,
        password: bcrypt.hashSync('Password123', 12),
      };
      mockAuthRepository.findOne.mockResolvedValue(pendingUser);

      await expect(
        service.login({
          email: pendingUser.email,
          password: 'Password123',
        })
      ).rejects.toThrow(ForbiddenException);
      expect(mockSessionService.create).not.toHaveBeenCalled();
    });

    it('requires TOTP for an administrator and does not create a session after password only', async () => {
      const administrator = {
        ...mockUser,
        role: UserRoles.Administrador,
        password: 'legacy-hash',
      };
      const challenge = {
        challengeToken: 'opaque-challenge',
        expiresAt: '2026-08-18T20:00:00.000Z',
        requiresTwoFactor: true as const,
        requiresTwoFactorSetup: false,
      };
      mockAuthRepository.findOne.mockResolvedValue(administrator);
      mockTwoFactorService.requiresTwoFactor.mockReturnValue(true);
      mockTwoFactorService.createChallenge.mockResolvedValue(challenge);

      const result = await service.login({
        email: administrator.email,
        password: 'Password123',
        rememberMe: true,
      });

      expect(result).toEqual(challenge);
      expect(mockTwoFactorService.createChallenge).toHaveBeenCalledWith(administrator, true);
      expect(mockSessionService.create).not.toHaveBeenCalled();
    });
  });

  describe('verifyOtp', () => {
    it('creates the opaque session only after the second factor succeeds', async () => {
      const administrator = { ...mockUser, role: UserRoles.Administrador };
      mockTwoFactorService.verifyChallenge.mockResolvedValue({
        rememberMe: true,
        user: administrator,
      });
      mockSessionService.create.mockResolvedValue({
        sessionToken: 'opaque-token',
        expiresAt: '2026-08-19T00:00:00.000Z',
      });

      const result = await service.verifyOtp({
        challengeToken: 'challenge-token-with-at-least-32-characters',
        otp: '123456',
      });

      expect(mockSessionService.create).toHaveBeenCalledWith(administrator, true, 'mfa', undefined);
      expect(result).toEqual(
        expect.objectContaining({ sessionToken: 'opaque-token', rememberMe: true })
      );
      expect(result).not.toHaveProperty('token');
    });
  });

  describe('active sessions', () => {
    it('lists sessions and marks the current opaque token through SessionService', async () => {
      const sessions = [{ id: 'a'.repeat(64), current: true }];
      mockSessionService.list.mockResolvedValue(sessions);

      await expect(service.listSessions(mockUser, 'opaque-session')).resolves.toEqual({ sessions });
      expect(mockSessionService.list).toHaveBeenCalledWith(mockUser, 'opaque-session');
    });

    it('revokes an owned session and reports whether it is the current one', async () => {
      const sessionId = 'a'.repeat(64);
      mockSessionService.isCurrent.mockReturnValue(true);
      mockSessionService.revokeOwned.mockResolvedValue(true);

      await expect(service.revokeSession(mockUser, sessionId, 'opaque-session')).resolves.toEqual({
        currentSession: true,
        revoked: true,
        success: true,
      });
      expect(mockSessionService.isCurrent).toHaveBeenCalledWith('opaque-session', sessionId);
      expect(mockSessionService.revokeOwned).toHaveBeenCalledWith(mockUser.id, sessionId);
    });
  });

  describe('logoutAllForUser', () => {
    it('prevents an institutional administrator from revoking another institution', async () => {
      const administrator = {
        ...mockUser,
        id: '54fd7dcb-cac6-4f7d-a279-c7792a16e3fd',
        role: UserRoles.Administrador,
      } as User;
      mockAuthRepository.findOneBy.mockResolvedValue({
        ...mockUser,
        institutionId: '2d65e30f-eb21-427a-a98c-cc0e169ee8f7',
      });

      await expect(service.logoutAllForUser(mockUser.id, administrator)).rejects.toThrow(
        ForbiddenException
      );
      expect(mockAuthRepository.increment).not.toHaveBeenCalled();
      expect(mockSessionService.revokeAll).not.toHaveBeenCalled();
    });
  });

  describe('validateUser', () => {
    it('should return user if active', async () => {
      mockAuthRepository.findOne.mockResolvedValue({ ...mockUser });

      const result = await service.validateUser(mockUser.id);

      expect(mockAuthRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        relations: ['institution'],
      });
      expect(result).toEqual(expect.objectContaining({ id: mockUser.id }));
      expect(result.password).toBeUndefined();
    });

    it('should throw UnauthorizedException if user is inactive', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      mockAuthRepository.findOne.mockResolvedValue(inactiveUser);

      await expect(service.validateUser(mockUser.id)).rejects.toThrow(UnauthorizedException);
    });
  });
});
