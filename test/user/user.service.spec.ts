import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UserService } from 'src/user/user.service';
import { User } from 'src/user/entities/user.entity';
import { MailService } from 'src/mail/mail.service';
import { AuthService } from 'src/auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { CreateUserInput } from 'src/user/dto/inputs/create-user.input';
import { UpdateUserInput } from 'src/user/dto/inputs/update-user.input';
import { DocumentType } from 'src/auth/enums/user-document-type.enum';
import { UserRoles } from 'src/auth/enums';

describe('UserService', () => {
  let service: UserService;
  let userRepository: Repository<User>;
  let mailService: MailService;
  let authService: AuthService;
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

  const mockUserRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOneByOrFail: jest.fn(),
    preload: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockMailService = {
    sendUpdatePassword: jest.fn(),
    sendResetPassword: jest.fn(),
  };

  const mockAuthService = {
    getToken: jest.fn(),
  };

  const mockJwtService = {
    verify: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: MailService,
          useValue: mockMailService,
        },
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    mailService = module.get<MailService>(MailService);
    authService = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new user with hashed password', async () => {
      const createUserInput: CreateUserInput = {
        name: 'John',
        last_name: 'Doe',
        document_type: DocumentType.CITIZENSHIP_CARD,
        document_num: 123456789,
        phone: 3001234567,
        email: 'john.doe@example.com',
        password: 'Password123',
        role: UserRoles.Estudiante,
      };

      const createdUser = { ...mockUser, password: createUserInput.password };
      mockUserRepository.create.mockReturnValue(createdUser);
      mockUserRepository.save.mockResolvedValue({ ...mockUser });
      mockMailService.sendUpdatePassword.mockResolvedValue(true);

      const result = await service.create(createUserInput);

      expect(mockUserRepository.create).toHaveBeenCalledWith(createUserInput);
      expect(mockMailService.sendUpdatePassword).toHaveBeenCalledWith(
        createdUser,
        createUserInput.password
      );
      expect(mockUserRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });

    it('should throw BadRequestException on duplicate email', async () => {
      const createUserInput: CreateUserInput = {
        name: 'John',
        last_name: 'Doe',
        document_type: DocumentType.CITIZENSHIP_CARD,
        document_num: 123456789,
        phone: 3001234567,
        email: 'john.doe@example.com',
        password: 'Password123',
        role: UserRoles.Estudiante,
      };

      mockUserRepository.create.mockReturnValue(mockUser);
      mockUserRepository.save.mockRejectedValue({
        code: '23505',
        detail: 'Key (email)=(john.doe@example.com) already exists.',
      });

      await expect(service.create(createUserInput)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return an array of users with allowed roles', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockUser]),
      };

      mockUserRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.findAll();

      expect(mockUserRepository.createQueryBuilder).toHaveBeenCalledWith('user');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('user.role IN (:...roles)', {
        roles: ['Estudiante', 'Profesor', 'Administrador'],
      });
      expect(result).toEqual([mockUser]);
    });
  });

  describe('findOneById', () => {
    it('should return a user by id', async () => {
      mockUserRepository.findOneByOrFail.mockResolvedValue(mockUser);

      const result = await service.findOneById(mockUser.id);

      expect(mockUserRepository.findOneByOrFail).toHaveBeenCalledWith({ id: mockUser.id });
      expect(result).toEqual(mockUser);
    });

    it('should throw BadRequestException when user not found', async () => {
      const userId = 'non-existent-id';
      mockUserRepository.findOneByOrFail.mockRejectedValue(new Error('Not found'));

      await expect(service.findOneById(userId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOneByEmail', () => {
    it('should return a user by email', async () => {
      mockUserRepository.findOneByOrFail.mockResolvedValue(mockUser);

      const result = await service.findOneByEmail(mockUser.email);

      expect(mockUserRepository.findOneByOrFail).toHaveBeenCalledWith({ email: mockUser.email });
      expect(result).toEqual(mockUser);
    });

    it('should throw BadRequestException when user not found', async () => {
      const email = 'nonexistent@example.com';
      mockUserRepository.findOneByOrFail.mockRejectedValue(new Error('Not found'));

      await expect(service.findOneByEmail(email)).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('should update a user without password change', async () => {
      const updateUserInput: UpdateUserInput = {
        id: mockUser.id,
        name: 'Jane',
        last_name: 'Doe',
        document_type: DocumentType.CITIZENSHIP_CARD,
        document_num: 123456789,
        phone: 3001234567,
        email: 'jane.doe@example.com',
        role: UserRoles.Estudiante,
        isActive: true,
      };

      const updatedUser = { ...mockUser, name: 'Jane' };
      mockUserRepository.preload.mockResolvedValue(updatedUser);
      mockUserRepository.save.mockResolvedValue(updatedUser);

      const result = await service.update(mockUser.id, updateUserInput);

      expect(mockUserRepository.preload).toHaveBeenCalledWith({
        id: mockUser.id,
        ...updateUserInput,
      });
      expect(mockMailService.sendUpdatePassword).not.toHaveBeenCalled();
      expect(mockUserRepository.save).toHaveBeenCalledWith(updatedUser);
      expect(result).toEqual(updatedUser);
    });

    it('should update a user with password change', async () => {
      const updateUserInput: UpdateUserInput = {
        id: mockUser.id,
        name: 'Jane',
        last_name: 'Doe',
        document_type: DocumentType.CITIZENSHIP_CARD,
        document_num: 123456789,
        phone: 3001234567,
        email: 'jane.doe@example.com',
        password: 'NewPassword123',
        role: UserRoles.Estudiante,
        isActive: true,
      };

      const updatedUser = { ...mockUser, name: 'Jane' };
      mockUserRepository.preload.mockResolvedValue(updatedUser);
      mockUserRepository.save.mockResolvedValue(updatedUser);
      mockMailService.sendUpdatePassword.mockResolvedValue(true);

      const result = await service.update(mockUser.id, updateUserInput);

      expect(mockMailService.sendUpdatePassword).toHaveBeenCalledWith(
        updatedUser,
        updateUserInput.password
      );
      expect(mockUserRepository.save).toHaveBeenCalled();
      expect(result).toEqual(updatedUser);
    });
  });

  describe('block', () => {
    it('should block a user by setting isActive to false', async () => {
      const blockedUser = { ...mockUser, isActive: false };
      mockUserRepository.findOneByOrFail.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue(blockedUser);

      const result = await service.block(mockUser.id);

      expect(result.isActive).toBe(false);
      expect(mockUserRepository.save).toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('should reset password and send email', async () => {
      mockUserRepository.findOneByOrFail.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);
      mockMailService.sendResetPassword.mockResolvedValue(true);

      const result = await service.resetPassword(mockUser.email);

      expect(mockUserRepository.findOneByOrFail).toHaveBeenCalledWith({ email: mockUser.email });
      expect(mockMailService.sendResetPassword).toHaveBeenCalled();
      expect(mockUserRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });

    it('should throw BadRequestException when user not found', async () => {
      const email = 'nonexistent@example.com';
      mockUserRepository.findOneByOrFail.mockRejectedValue(new Error('Not found'));

      await expect(service.resetPassword(email)).rejects.toThrow(BadRequestException);
    });
  });

  describe('resetPasswordAuth', () => {
    it('should reset password for authenticated user', async () => {
      const newPassword = 'NewPassword123';
      const token = 'valid-jwt-token';
      const decodedToken = { id: mockUser.id };

      mockAuthService.getToken.mockReturnValue(token);
      mockJwtService.verify.mockReturnValue(decodedToken);
      mockUserRepository.findOneByOrFail.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);
      mockMailService.sendResetPassword.mockResolvedValue(true);

      const result = await service.resetPasswordAuth(newPassword, mockUser);

      expect(mockAuthService.getToken).toHaveBeenCalledWith(mockUser);
      expect(mockJwtService.verify).toHaveBeenCalledWith(token);
      expect(mockMailService.sendResetPassword).toHaveBeenCalledWith(mockUser, newPassword);
      expect(mockUserRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });
  });

  describe('handleDBException', () => {
    it('should throw InternalServerErrorException for unexpected errors', async () => {
      const createUserInput: CreateUserInput = {
        name: 'John',
        last_name: 'Doe',
        document_type: DocumentType.CITIZENSHIP_CARD,
        document_num: 123456789,
        phone: 3001234567,
        email: 'john.doe@example.com',
        password: 'Password123',
        role: UserRoles.Estudiante,
      };

      mockUserRepository.create.mockReturnValue(mockUser);
      mockUserRepository.save.mockRejectedValue({
        code: 'UNKNOWN_ERROR',
        detail: 'Some unexpected error',
      });

      await expect(service.create(createUserInput)).rejects.toThrow(InternalServerErrorException);
    });
  });
});
