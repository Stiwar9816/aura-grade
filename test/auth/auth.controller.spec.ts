import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from 'src/auth/auth.controller';
import { AuthService } from 'src/auth/auth.service';
import { CreateUserDto, LoginUserDto } from 'src/auth/dto';
import { DocumentType, UserRoles } from 'src/auth/enums';
import { JwtAuthGuard } from 'src/auth/guards';

describe('AuthController', () => {
  const institutionId = 'f1d24f6e-b766-4e3f-a1c9-4d4c0a58ad31';
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
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
    authService = module.get<AuthService>(AuthService);

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
});
