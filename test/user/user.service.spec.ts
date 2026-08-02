import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UserService } from 'src/user/user.service';
import { User } from 'src/user/entities/user.entity';
import { Course } from 'src/course/entities/course.entity';
import { MailService } from 'src/mail/mail.service';
import { AuthService } from 'src/auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { CreateUserInput } from 'src/user/dto/inputs/create-user.input';
import { UpdateUserInput } from 'src/user/dto/inputs/update-user.input';
import { DocumentType } from 'src/auth/enums/user-document-type.enum';
import { UserRoles } from 'src/auth/enums';
import { InstitutionApprovalStatus } from 'src/institution';

describe('UserService', () => {
  const institutionId = 'f1d24f6e-b766-4e3f-a1c9-4d4c0a58ad31';
  const institution = {
    id: institutionId,
    name: 'Universidad Aura',
    slug: 'universidad-aura',
    emailDomain: 'aura.edu.co',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
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
    approvalStatus: InstitutionApprovalStatus.APPROVED,
    institutionId,
    institution,
    authVersion: 1,
    checkFieldsBeforeInsert: jest.fn(),
    checkFieldsBeforeUpdate: jest.fn(),
  };

  const mockUserRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    findOneByOrFail: jest.fn(),
    preload: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockCourseRepository = {
    findBy: jest.fn(),
  };

  const mockMailService = {
    sendUpdatePassword: jest.fn(),
    sendResetPassword: jest.fn(),
  };

  const mockAuthService = {
    getToken: jest.fn(),
    forgotPassword: jest.fn(),
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
          provide: getRepositoryToken(Course),
          useValue: mockCourseRepository,
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
      expect(mockMailService.sendUpdatePassword).not.toHaveBeenCalled();
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
      mockUserRepository.find.mockResolvedValue([mockUser]);

      const result = await service.findAll(mockUser);

      expect(mockUserRepository.find).toHaveBeenCalledWith({
        where: {
          role: expect.anything(),
          institutionId,
        },
        relations: [
          'courses',
          'submissions',
          'submissions.evaluation',
          'submissions.assignment',
          'submissions.assignment.rubric',
        ],
      });
      expect(result).toEqual([mockUser]);
    });
  });

  describe('institutional approvals', () => {
    const administrator = {
      ...mockUser,
      id: '63933a5f-aac8-4093-a287-30b570cc0d9d',
      role: UserRoles.Administrador,
    } as User;

    it('lists only pending users from the administrator institution', async () => {
      mockUserRepository.find.mockResolvedValue([]);

      await service.findPendingInstitutionUsers(administrator);

      expect(mockUserRepository.find).toHaveBeenCalledWith({
        where: {
          institutionId,
          approvalStatus: InstitutionApprovalStatus.PENDING,
          role: expect.anything(),
        },
        order: { name: 'ASC', last_name: 'ASC' },
      });
    });

    it('approves a user from the same institution and invalidates old sessions', async () => {
      const pendingUser = {
        ...mockUser,
        approvalStatus: InstitutionApprovalStatus.PENDING,
      };
      mockUserRepository.findOneBy.mockResolvedValue(pendingUser);
      mockUserRepository.save.mockImplementation(async (user) => user);

      const result = await service.reviewInstitutionUser(
        {
          userId: pendingUser.id,
          status: InstitutionApprovalStatus.APPROVED,
        },
        administrator
      );

      expect(result.approvalStatus).toBe(InstitutionApprovalStatus.APPROVED);
      expect(result.authVersion).toBe(2);
    });

    it('rejects cross-institution review attempts', async () => {
      mockUserRepository.findOneBy.mockResolvedValue({
        ...mockUser,
        institutionId: '46dcda76-9df1-421c-866d-23e95de2e639',
        approvalStatus: InstitutionApprovalStatus.PENDING,
      });

      await expect(
        service.reviewInstitutionUser(
          {
            userId: mockUser.id,
            status: InstitutionApprovalStatus.APPROVED,
          },
          administrator
        )
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('findOneById', () => {
    it('should return a user by id', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findOneById(mockUser.id);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        relations: [
          'courses',
          'submissions',
          'submissions.evaluation',
          'submissions.assignment',
          'submissions.assignment.rubric',
        ],
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when user not found', async () => {
      const userId = 'non-existent-id';
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.findOneById(userId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOneByEmail', () => {
    it('should return a user by email', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findOneByEmail(mockUser.email);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email: mockUser.email },
        relations: ['courses'],
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when user not found', async () => {
      const email = 'nonexistent@example.com';
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.findOneByEmail(email)).rejects.toThrow(NotFoundException);
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
      mockUserRepository.findOne.mockResolvedValue(mockUser);
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
      mockUserRepository.findOne.mockResolvedValue(mockUser);
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

    it('should not persist a password change when its email cannot be sent', async () => {
      const updateUserInput: UpdateUserInput = {
        id: mockUser.id,
        password: 'NewPassword123',
        role: UserRoles.Estudiante,
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.preload.mockResolvedValue({ ...mockUser });
      mockMailService.sendUpdatePassword.mockRejectedValue(new Error('Email delivery failed'));

      await expect(service.update(mockUser.id, updateUserInput)).rejects.toThrow(
        'Email delivery failed'
      );
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('block', () => {
    it('should block a user by setting isActive to false', async () => {
      const blockedUser = { ...mockUser, isActive: false };
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue(blockedUser);

      const result = await service.block(mockUser.id);

      expect(result.isActive).toBe(false);
      expect(mockUserRepository.save).toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('should delegate password recovery to AuthService', async () => {
      mockAuthService.forgotPassword.mockResolvedValue(mockUser);

      const result = await service.resetPassword(mockUser.email);

      expect(mockAuthService.forgotPassword).toHaveBeenCalledWith(mockUser.email);
      expect(result).toEqual(mockUser);
    });

    it('should propagate recovery failures', async () => {
      mockAuthService.forgotPassword.mockRejectedValue(new Error('Email delivery failed'));

      await expect(service.resetPassword(mockUser.email)).rejects.toThrow('Email delivery failed');
    });
  });

  describe('resetPasswordAuth', () => {
    it('should reset password for authenticated user', async () => {
      const newPassword = 'NewPassword123';

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);
      mockMailService.sendUpdatePassword.mockResolvedValue(true);

      const result = await service.resetPasswordAuth(newPassword, mockUser);

      expect(mockMailService.sendUpdatePassword).toHaveBeenCalledWith(mockUser, newPassword);
      expect(mockMailService.sendResetPassword).not.toHaveBeenCalled();
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
