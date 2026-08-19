import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from 'src/auth/auth.controller';
import { AuthService } from 'src/auth/auth.service';
import { CreateUserDto, ForgotPasswordDto, LoginUserDto } from 'src/auth/dto';
import { DocumentType, UserRoles } from 'src/auth/enums';
import { JwtAuthGuard } from 'src/auth/guards';

describe('AuthController', () => {
  const institutionId = 'f1d24f6e-b766-4e3f-a1c9-4d4c0a58ad31';
  let controller: AuthController;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    verifyOtp: jest.fn(),
    forgotPassword: jest.fn(),
    listSessions: jest.fn(),
    revokeSession: jest.fn(),
  };
  const unknownDevice = {
    browser: 'Navegador desconocido',
    deviceType: 'unknown',
    ipAddress: '127.0.0.1',
    name: 'Navegador desconocido en Sistema desconocido',
    operatingSystem: 'Sistema desconocido',
  };

  const mockUserResponse = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'John',
    last_name: 'Doe',
    document_type: DocumentType.CITIZENSHIP_CARD,
    document_num: 123456789,
    phone: 3001234567,
    email: 'john.doe@example.com',
    isActive: true,
    role: UserRoles.Estudiante,
    pendingApproval: true,
    message: 'Tu registro fue recibido y está pendiente de aprobación institucional.',
  };
  const mockLoginResponse = {
    ...mockUserResponse,
    pendingApproval: undefined,
    message: undefined,
    token: 'opaque-token',
    sessionToken: 'opaque-token',
    expiresAt: '2026-07-29T00:00:00.000Z',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user', async () => {
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

      mockAuthService.register.mockResolvedValue(mockUserResponse);

      const result = await controller.register(createUserDto);

      expect(mockAuthService.register).toHaveBeenCalledWith(createUserDto);
      expect(result).toEqual(mockUserResponse);
      expect(result.pendingApproval).toBe(true);
      expect(result).not.toHaveProperty('token');
    });

    it('should return user without password', async () => {
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

      mockAuthService.register.mockResolvedValue(mockUserResponse);

      const result = await controller.register(createUserDto);

      expect(result).not.toHaveProperty('password');
    });
  });

  describe('login', () => {
    it('should login a user', async () => {
      const loginUserDto: LoginUserDto = {
        email: 'john.doe@example.com',
        password: 'Password123',
      };

      mockAuthService.login.mockResolvedValue(mockLoginResponse);

      const request = { ip: '127.0.0.1' } as any;
      const result = await controller.login(loginUserDto, request);

      expect(mockAuthService.login).toHaveBeenCalledWith(
        loginUserDto,
        '127.0.0.1:john.doe@example.com'
      );
      expect(result).toEqual(mockLoginResponse);
      expect(result).toHaveProperty('token');
    });

    it('should return user without password', async () => {
      const loginUserDto: LoginUserDto = {
        email: 'john.doe@example.com',
        password: 'Password123',
      };

      mockAuthService.login.mockResolvedValue(mockLoginResponse);

      const result = await controller.login(loginUserDto, {
        ip: '127.0.0.1',
      } as any);

      expect(result).not.toHaveProperty('password');
    });
  });

  describe('forgotPassword', () => {
    it('should request password recovery and return an accepted response', async () => {
      const dto: ForgotPasswordDto = { email: 'john.doe@example.com' };
      mockAuthService.forgotPassword.mockResolvedValue(mockUserResponse);

      const result = await controller.forgotPassword(dto);

      expect(mockAuthService.forgotPassword).toHaveBeenCalledWith(dto.email);
      expect(result).toEqual({
        message: 'Revisa tu correo para continuar con el restablecimiento de contraseña.',
      });
    });
  });

  describe('verifyOtp', () => {
    it('delegates the opaque challenge and one-time code', async () => {
      const input = {
        challengeToken: 'challenge-token-with-at-least-32-characters',
        otp: '123456',
      };
      mockAuthService.verifyOtp.mockResolvedValue(mockLoginResponse);

      await expect(
        controller.verifyOtp(input, { headers: {}, ip: '127.0.0.1' } as any)
      ).resolves.toEqual(mockLoginResponse);
      expect(mockAuthService.verifyOtp).toHaveBeenCalledWith(input, unknownDevice);
    });
  });

  describe('sessions', () => {
    const authenticatedRequest = {
      headers: {},
      ip: '127.0.0.1',
      sessionToken: 'current-opaque-session',
      user: mockUserResponse,
    } as any;

    it('lists the current user sessions', async () => {
      const response = { sessions: [] };
      mockAuthService.listSessions.mockResolvedValue(response);

      await expect(controller.listSessions(authenticatedRequest)).resolves.toEqual(response);
      expect(mockAuthService.listSessions).toHaveBeenCalledWith(
        mockUserResponse,
        'current-opaque-session'
      );
    });

    it('revokes only a session owned by the current user', async () => {
      const sessionId = 'a'.repeat(64);
      const response = { currentSession: false, revoked: true, success: true };
      mockAuthService.revokeSession.mockResolvedValue(response);

      await expect(controller.revokeSession(sessionId, authenticatedRequest)).resolves.toEqual(
        response
      );
      expect(mockAuthService.revokeSession).toHaveBeenCalledWith(
        mockUserResponse,
        sessionId,
        'current-opaque-session'
      );
    });
  });
});
