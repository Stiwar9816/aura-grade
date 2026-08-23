import { Test, TestingModule } from '@nestjs/testing';
import { UserResolver } from 'src/user/user.resolver';
import { UserService } from 'src/user/user.service';
import { User } from 'src/user/entities/user.entity';
import { UpdateUserInput } from 'src/user/dto';
import { DocumentType } from 'src/auth/enums/user-document-type.enum';
import { UserRoles } from 'src/auth/enums';
import { JwtAuthGuard } from 'src/auth/guards';
import { InstitutionApprovalStatus } from 'src/institution';
import { UserImportService } from 'src/user/import/user-import.service';

describe('UserResolver', () => {
  const institutionId = 'f1d24f6e-b766-4e3f-a1c9-4d4c0a58ad31';
  let resolver: UserResolver;

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
    role: UserRoles.Administrador,
    approvalStatus: InstitutionApprovalStatus.APPROVED,
    institutionId,
    institution: {
      id: institutionId,
      name: 'Universidad Aura',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    authVersion: 1,
    isPlatformAdmin: true,
    checkFieldsBeforeInsert: jest.fn(),
    checkFieldsBeforeUpdate: jest.fn(),
  };

  const mockUserService = {
    findAll: jest.fn(),
    findOneById: jest.fn(),
    findOneByEmail: jest.fn(),
    findOneForActor: jest.fn(),
    findOneByEmailForActor: jest.fn(),
    update: jest.fn(),
    updateOwnProfile: jest.fn(),
    block: jest.fn(),
    resetPassword: jest.fn(),
    resetPasswordAuth: jest.fn(),
    findPendingInstitutionUsers: jest.fn(),
    reviewInstitutionUser: jest.fn(),
    assignCourses: jest.fn(),
  };
  const mockUserImportService = {
    import: jest.fn(),
    importPlatformAdministrators: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserResolver,
        {
          provide: UserService,
          useValue: mockUserService,
        },
        {
          provide: UserImportService,
          useValue: mockUserImportService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    resolver = module.get<UserResolver>(UserResolver);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('institutional approvals', () => {
    it('returns pending users for the current administrator', async () => {
      mockUserService.findPendingInstitutionUsers.mockResolvedValue([mockUser]);

      const result = await resolver.findPendingInstitutionUsers(mockUser);

      expect(mockUserService.findPendingInstitutionUsers).toHaveBeenCalledWith(mockUser);
      expect(result).toEqual([mockUser]);
    });

    it('reviews a pending user', async () => {
      const input = {
        userId: mockUser.id,
        status: InstitutionApprovalStatus.APPROVED,
      };
      mockUserService.reviewInstitutionUser.mockResolvedValue(mockUser);

      const result = await resolver.reviewInstitutionUser(input, mockUser);

      expect(mockUserService.reviewInstitutionUser).toHaveBeenCalledWith(input, mockUser);
      expect(result).toEqual(mockUser);
    });
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  describe('findAll', () => {
    it('should return an array of users', async () => {
      const users = [mockUser];
      mockUserService.findAll.mockResolvedValue(users);

      const result = await resolver.findAll(mockUser);

      expect(mockUserService.findAll).toHaveBeenCalled();
      expect(result).toEqual(users);
    });
  });

  describe('findOne', () => {
    it('should return a user by id', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      mockUserService.findOneForActor.mockResolvedValue(mockUser);

      const result = await resolver.findOne(userId, mockUser);

      expect(mockUserService.findOneForActor).toHaveBeenCalledWith(userId, mockUser);
      expect(result).toEqual(mockUser);
    });

    it('should handle UUID validation', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      mockUserService.findOneForActor.mockResolvedValue(mockUser);

      const result = await resolver.findOne(userId, mockUser);

      expect(result).toEqual(mockUser);
    });
  });

  describe('findOneByEmail', () => {
    it('should return a user by email', async () => {
      const email = 'john.doe@example.com';
      mockUserService.findOneByEmailForActor.mockResolvedValue(mockUser);

      const result = await resolver.findOneByEmail(email, mockUser);

      expect(mockUserService.findOneByEmailForActor).toHaveBeenCalledWith(email, mockUser);
      expect(result).toEqual(mockUser);
    });
  });

  describe('updateUser', () => {
    it('should update a user', async () => {
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
      mockUserService.update.mockResolvedValue(updatedUser);

      const result = await resolver.updateUser(updateUserInput, mockUser);

      expect(mockUserService.update).toHaveBeenCalledWith(
        updateUserInput.id,
        updateUserInput,
        mockUser
      );
      expect(result).toEqual(updatedUser);
    });

    it('should update only the authenticated user profile through the dedicated operation', async () => {
      const input = { name: 'Jane', last_name: 'Doe' };
      const updatedUser = { ...mockUser, ...input };
      mockUserService.updateOwnProfile.mockResolvedValue(updatedUser);

      const result = await resolver.updateMyProfile(input, mockUser);

      expect(mockUserService.updateOwnProfile).toHaveBeenCalledWith(input, mockUser);
      expect(result).toEqual(updatedUser);
    });
  });

  describe('blockUser', () => {
    it('should block a user', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const blockedUser = { ...mockUser, isActive: false };
      mockUserService.block.mockResolvedValue(blockedUser);

      const result = await resolver.blockUser(userId, mockUser);

      expect(mockUserService.block).toHaveBeenCalledWith(userId, mockUser);
      expect(result).toEqual(blockedUser);
      expect(result.isActive).toBe(false);
    });
  });

  describe('resetPassword', () => {
    it('should reset password for a user', async () => {
      const email = 'john.doe@example.com';
      mockUserService.resetPassword.mockResolvedValue(true);

      const result = await resolver.resetPassword(email);

      expect(mockUserService.resetPassword).toHaveBeenCalledWith(email);
      expect(result).toBe(true);
    });
  });

  describe('resetPasswordAuth', () => {
    it('should reset password for authenticated user', async () => {
      const newPassword = 'NewPassword123';
      mockUserService.resetPasswordAuth.mockResolvedValue(mockUser);

      const result = await resolver.resetPasswordAuth({ newPassword }, mockUser);

      expect(mockUserService.resetPasswordAuth).toHaveBeenCalledWith(newPassword, mockUser);
      expect(result).toEqual(mockUser);
    });
  });

  describe('assignCoursesToUser', () => {
    it('passes the authenticated administrator or teacher to the service authorization boundary', async () => {
      const input = {
        userId: mockUser.id,
        courseIds: ['b8a98148-5341-4d8e-a968-d4601ec38522'],
      };
      mockUserService.assignCourses.mockResolvedValue(mockUser);

      const result = await resolver.assignCoursesToUser(input, mockUser);

      expect(mockUserService.assignCourses).toHaveBeenCalledWith(input, mockUser);
      expect(result).toEqual(mockUser);
    });
  });

  describe('personal field privacy', () => {
    const student = {
      ...mockUser,
      id: '971715a2-d37f-45c4-b4ab-866f87e7ce60',
      role: UserRoles.Estudiante,
      isPlatformAdmin: false,
    } as User;
    const teacher = {
      ...mockUser,
      id: '7882f5d0-c0cb-47f0-8b5e-4cbd1df0475f',
      role: UserRoles.Docente,
      isPlatformAdmin: false,
    } as User;

    it('allows a teacher to read student contact data but not identity documents', () => {
      const context = { req: { user: teacher } };

      expect(resolver.email(student, context)).toBe(student.email);
      expect(resolver.phone(student, context)).toBe(student.phone);
      expect(resolver.document_num(student, context)).toBeNull();
      expect(resolver.document_type(student, context)).toBeNull();
    });

    it('hides another user personal data from a student', () => {
      const otherStudent = { ...student, id: '25bb0e9d-7075-4d7f-9684-a95afe02d3ae' } as User;
      const context = { req: { user: student } };

      expect(resolver.email(otherStudent, context)).toBeNull();
      expect(resolver.phone(otherStudent, context)).toBeNull();
      expect(resolver.document_num(otherStudent, context)).toBeNull();
      expect(resolver.courses(otherStudent, context)).toEqual([]);
      expect(resolver.submissions(otherStudent, context)).toEqual([]);
    });

    it('returns to a teacher only submissions from assignments owned by that teacher', () => {
      const ownSubmission = {
        id: 'own-submission',
        assignment: { user: { id: teacher.id } },
      };
      const foreignSubmission = {
        id: 'foreign-submission',
        assignment: { user: { id: 'other-teacher-id' } },
      };
      const context = { req: { user: teacher } };

      expect(
        resolver.submissions(
          { ...student, submissions: [ownSubmission, foreignSubmission] } as User,
          context
        )
      ).toEqual([ownSubmission]);
    });
  });
});
