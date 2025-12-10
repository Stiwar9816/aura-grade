import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BadRequestException,
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

describe('AuthService', () => {
  let service: AuthService;
  let authRepository: Repository<User>;
  let mailService: MailService;
  let jwtService: JwtService;

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
    checkFieldsBeforeInsert: jest.fn(),
    checkFieldsBeforeUpdate: jest.fn(),
  };

  const mockAuthRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    findOneByOrFail: jest.fn(),
  };

  const mockMailService = {
    sendUserConfirmation: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

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
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    authRepository = module.get<Repository<User>>(getRepositoryToken(User));
    mailService = module.get<MailService>(MailService);
    jwtService = module.get<JwtService>(JwtService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getToken', () => {
    it('should generate a JWT token', () => {
      const payload = {
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        last_name: mockUser.last_name,
        role: mockUser.role,
      };
      const token = 'mock-jwt-token';
      mockJwtService.sign.mockReturnValue(token);

      const result = service.getToken(payload);

      expect(mockJwtService.sign).toHaveBeenCalledWith(payload);
      expect(result).toBe(token);
    });
  });

  describe('create', () => {
    it('should create a new user and return user with token', async () => {
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

      const hashedPassword = 'hashedPassword123';
      jest.spyOn(bcrypt, 'hashSync').mockReturnValue(hashedPassword as never);

      const createdUser = { ...mockUser, password: hashedPassword };
      mockAuthRepository.create.mockReturnValue(createdUser);
      mockAuthRepository.save.mockResolvedValue(createdUser);
      mockMailService.sendUserConfirmation.mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('mock-token');

      const result = await service.create(createUserDto);

      expect(mockAuthRepository.create).toHaveBeenCalledWith({
        ...createUserDto,
        password: hashedPassword,
      });
      expect(mockAuthRepository.save).toHaveBeenCalled();
      expect(mockMailService.sendUserConfirmation).toHaveBeenCalledWith(
        createdUser,
        createUserDto.password
      );
      expect(result).toHaveProperty('token');
      expect(result.password).toBeUndefined();
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
      };

      mockAuthRepository.create.mockReturnValue(mockUser);
      mockAuthRepository.save.mockRejectedValue({
        code: '23505',
        detail: 'Key (email)=(john.doe@example.com) already exists.',
      });

      await expect(service.create(createUserDto)).rejects.toThrow(BadRequestException);
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
      };

      mockAuthRepository.create.mockReturnValue(mockUser);
      mockAuthRepository.save.mockRejectedValue({
        code: 'UNKNOWN_ERROR',
        detail: 'Some unexpected error',
      });

      await expect(service.create(createUserDto)).rejects.toThrow(InternalServerErrorException);
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
      mockAuthRepository.findOneByOrFail.mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compareSync').mockReturnValue(true as never);
      mockJwtService.sign.mockReturnValue('mock-token');

      const result = await service.login(loginUserDto);

      expect(mockAuthRepository.findOne).toHaveBeenCalledWith({
        where: { email: loginUserDto.email },
        select: { email: true, password: true, id: true, name: true, role: true },
      });
      expect(result).toHaveProperty('token');
      expect(result.password).toBeUndefined();
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

    it('should throw BadRequestException if password does not match', async () => {
      const loginUserDto: LoginUserDto = {
        email: 'john.doe@example.com',
        password: 'WrongPassword',
      };

      const userWithPassword = { ...mockUser, password: bcrypt.hashSync('Password123', 12) };
      mockAuthRepository.findOne.mockResolvedValue(userWithPassword);
      mockAuthRepository.findOneByOrFail.mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compareSync').mockReturnValue(false as never);

      await expect(service.login(loginUserDto)).rejects.toThrow(BadRequestException);
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
      mockAuthRepository.findOneByOrFail.mockResolvedValue(inactiveUser);

      await expect(service.login(loginUserDto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('validateUser', () => {
    it('should return user if active', async () => {
      mockAuthRepository.findOneByOrFail.mockResolvedValue(mockUser);

      const result = await service.validateUser(UserRoles.Estudiante);

      expect(mockAuthRepository.findOneByOrFail).toHaveBeenCalledWith({
        role: UserRoles.Estudiante,
      });
      expect(result).toEqual(mockUser);
      expect(result.password).toBeUndefined();
    });

    it('should throw UnauthorizedException if user is inactive', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      mockAuthRepository.findOneByOrFail.mockResolvedValue(inactiveUser);

      await expect(service.validateUser(UserRoles.Estudiante)).rejects.toThrow(
        UnauthorizedException
      );
    });
  });
});
