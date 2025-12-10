import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from 'src/auth/auth.controller';
import { AuthService } from 'src/auth/auth.service';
import { CreateUserDto, LoginUserDto } from 'src/auth/dto';
import { DocumentType, UserRoles } from 'src/auth/enums';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    create: jest.fn(),
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
    token: 'mock-jwt-token',
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
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('craate (register)', () => {
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
      };

      mockAuthService.create.mockResolvedValue(mockUserResponse);

      const result = await controller.craate(createUserDto);

      expect(mockAuthService.create).toHaveBeenCalledWith(createUserDto);
      expect(result).toEqual(mockUserResponse);
      expect(result).toHaveProperty('token');
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
      };

      mockAuthService.create.mockResolvedValue(mockUserResponse);

      const result = await controller.craate(createUserDto);

      expect(result).not.toHaveProperty('password');
    });
  });

  describe('login', () => {
    it('should login a user', async () => {
      const loginUserDto: LoginUserDto = {
        email: 'john.doe@example.com',
        password: 'Password123',
      };

      mockAuthService.login.mockResolvedValue(mockUserResponse);

      const result = await controller.login(loginUserDto);

      expect(mockAuthService.login).toHaveBeenCalledWith(loginUserDto);
      expect(result).toEqual(mockUserResponse);
      expect(result).toHaveProperty('token');
    });

    it('should return user without password', async () => {
      const loginUserDto: LoginUserDto = {
        email: 'john.doe@example.com',
        password: 'Password123',
      };

      mockAuthService.login.mockResolvedValue(mockUserResponse);

      const result = await controller.login(loginUserDto);

      expect(result).not.toHaveProperty('password');
    });
  });
});
