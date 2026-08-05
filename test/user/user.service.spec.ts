import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
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
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  let service: UserService;

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
    isPlatformAdmin: false,
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
    find: jest.fn(),
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
      const administrator = { ...mockUser, role: UserRoles.Administrador } as User;

      const result = await service.findAll(administrator);

      expect(mockUserRepository.find).toHaveBeenCalledWith({
        where: {
          role: expect.anything(),
          institutionId,
        },
        relations: [
          'courses',
          'courses.user',
          'submissions',
          'submissions.evaluation',
          'submissions.assignment',
          'submissions.assignment.user',
          'submissions.assignment.rubric',
          'assignments',
        ],
      });
      expect(result).toEqual([mockUser]);
    });

    it('limits a teacher listing to self and institutional students and removes foreign work', async () => {
      const teacher = {
        ...mockUser,
        id: '7882f5d0-c0cb-47f0-8b5e-4cbd1df0475f',
        role: UserRoles.Docente,
      } as User;
      const ownSubmission = { id: 'own', assignment: { user: { id: teacher.id } } };
      const foreignSubmission = {
        id: 'foreign',
        assignment: { user: { id: 'other-teacher-id' } },
      };
      const student = {
        ...mockUser,
        submissions: [ownSubmission, foreignSubmission],
        assignments: [{ id: 'student-assignment' }],
      } as User;
      mockUserRepository.find.mockResolvedValue([teacher, student]);

      const result = await service.findAll(teacher);

      expect(mockUserRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: [
            { id: teacher.id, institutionId },
            { role: UserRoles.Estudiante, institutionId },
          ],
        })
      );
      expect(result[1].submissions).toEqual([ownSubmission]);
      expect(result[1].assignments).toEqual([]);
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
          'courses.user',
          'submissions',
          'submissions.evaluation',
          'submissions.assignment',
          'submissions.assignment.user',
          'submissions.assignment.rubric',
          'assignments',
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
        relations: ['courses', 'courses.user'],
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when user not found', async () => {
      const email = 'nonexistent@example.com';
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.findOneByEmail(email)).rejects.toThrow(NotFoundException);
    });
  });

  describe('actor-scoped user lookups', () => {
    const teacher = {
      ...mockUser,
      id: '7882f5d0-c0cb-47f0-8b5e-4cbd1df0475f',
      role: UserRoles.Docente,
    } as User;

    it('hides users from another institution', async () => {
      mockUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        institutionId: '46dcda76-9df1-421c-866d-23e95de2e639',
      });

      await expect(service.findOneForActor(mockUser.id, teacher)).rejects.toBeInstanceOf(
        NotFoundException
      );
    });

    it('does not allow a teacher to inspect another teacher', async () => {
      mockUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        role: UserRoles.Docente,
      });

      await expect(service.findOneForActor(mockUser.id, teacher)).rejects.toBeInstanceOf(
        NotFoundException
      );
    });

    it('allows a teacher to inspect an institutional student and filters foreign submissions', async () => {
      const ownSubmission = { id: 'own', assignment: { user: { id: teacher.id } } };
      const foreignSubmission = {
        id: 'foreign',
        assignment: { user: { id: 'other-teacher-id' } },
      };
      mockUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        submissions: [ownSubmission, foreignSubmission],
      });

      const result = await service.findOneForActor(mockUser.id, teacher);

      expect(result.submissions).toEqual([ownSubmission]);
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

      const result = await service.update(mockUser.id, updateUserInput, mockUser);

      expect(mockUserRepository.preload).toHaveBeenCalledWith({
        id: mockUser.id,
        name: updateUserInput.name,
        last_name: updateUserInput.last_name,
        document_type: updateUserInput.document_type,
        document_num: updateUserInput.document_num,
        phone: updateUserInput.phone,
        email: updateUserInput.email,
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

      const result = await service.update(mockUser.id, updateUserInput, mockUser);

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

      await expect(service.update(mockUser.id, updateUserInput, mockUser)).rejects.toThrow(
        'Email delivery failed'
      );
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });

    it('allows every authenticated role to update only its own personal data', async () => {
      const teacher = {
        ...mockUser,
        id: '0a0bde0c-496d-4b36-86e3-c27a7f3765d3',
        role: UserRoles.Docente,
      } as User;
      const updatedTeacher = { ...teacher, name: 'Andrea' };
      mockUserRepository.findOne.mockResolvedValue(teacher);
      mockUserRepository.preload.mockResolvedValue(updatedTeacher);
      mockUserRepository.save.mockResolvedValue(updatedTeacher);

      const result = await service.updateOwnProfile({ name: 'Andrea' }, teacher);

      expect(mockUserRepository.preload).toHaveBeenCalledWith({
        id: teacher.id,
        name: 'Andrea',
      });
      expect(result).toEqual(updatedTeacher);
    });

    it('prevents a teacher from updating a student', async () => {
      const teacher = {
        ...mockUser,
        id: '0a0bde0c-496d-4b36-86e3-c27a7f3765d3',
        role: UserRoles.Docente,
      } as User;

      await expect(
        service.update(
          mockUser.id,
          { id: mockUser.id, name: 'Alterado', role: UserRoles.Estudiante },
          teacher
        )
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(mockUserRepository.findOne).not.toHaveBeenCalled();
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });

    it('prevents a student from updating another user', async () => {
      const anotherUserId = '0a0bde0c-496d-4b36-86e3-c27a7f3765d3';

      await expect(
        service.update(
          anotherUserId,
          { id: anotherUserId, name: 'Alterado', role: UserRoles.Docente },
          mockUser
        )
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(mockUserRepository.findOne).not.toHaveBeenCalled();
    });

    it('prevents an institution administrator from overwriting another user personal data', async () => {
      const administrator = {
        ...mockUser,
        id: '63933a5f-aac8-4093-a287-30b570cc0d9d',
        role: UserRoles.Administrador,
      } as User;

      await expect(
        service.update(
          mockUser.id,
          { id: mockUser.id, name: 'Alterado', role: UserRoles.Estudiante },
          administrator
        )
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(mockUserRepository.findOne).not.toHaveBeenCalled();
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });

    it('prevents a user from changing its own role', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      await expect(
        service.update(mockUser.id, { id: mockUser.id, role: UserRoles.Administrador }, mockUser)
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(mockUserRepository.preload).not.toHaveBeenCalled();
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('block', () => {
    it('should block a user by setting isActive to false', async () => {
      const administrator = {
        ...mockUser,
        id: '63933a5f-aac8-4093-a287-30b570cc0d9d',
        role: UserRoles.Administrador,
      } as User;
      const target = { ...mockUser };
      const blockedUser = { ...target, isActive: false };
      mockUserRepository.findOne.mockResolvedValue(target);
      mockUserRepository.save.mockResolvedValue(blockedUser);

      const result = await service.block(target.id, administrator);

      expect(result.isActive).toBe(false);
      expect(mockUserRepository.save).toHaveBeenCalled();
    });

    it('prevents a teacher from blocking a student', async () => {
      const teacher = {
        ...mockUser,
        id: '0a0bde0c-496d-4b36-86e3-c27a7f3765d3',
        role: UserRoles.Docente,
      } as User;

      await expect(service.block(mockUser.id, teacher)).rejects.toBeInstanceOf(ForbiddenException);
      expect(mockUserRepository.findOne).not.toHaveBeenCalled();
    });

    it('prevents an institution administrator from blocking a cross-institution user', async () => {
      const administrator = {
        ...mockUser,
        id: '63933a5f-aac8-4093-a287-30b570cc0d9d',
        role: UserRoles.Administrador,
      } as User;
      mockUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        institutionId: '46dcda76-9df1-421c-866d-23e95de2e639',
      });

      await expect(service.block(mockUser.id, administrator)).rejects.toBeInstanceOf(
        ForbiddenException
      );
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });

    it('prevents administrators from blocking another administrator', async () => {
      const administrator = {
        ...mockUser,
        id: '63933a5f-aac8-4093-a287-30b570cc0d9d',
        role: UserRoles.Administrador,
      } as User;
      mockUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        id: '0a0bde0c-496d-4b36-86e3-c27a7f3765d3',
        role: UserRoles.Administrador,
      });

      await expect(
        service.block('0a0bde0c-496d-4b36-86e3-c27a7f3765d3', administrator)
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(mockUserRepository.save).not.toHaveBeenCalled();
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

  describe('assignCourses', () => {
    const teacher = {
      ...mockUser,
      id: '0a0bde0c-496d-4b36-86e3-c27a7f3765d3',
      role: UserRoles.Docente,
    } as User;
    const administrator = {
      ...mockUser,
      id: '63933a5f-aac8-4093-a287-30b570cc0d9d',
      role: UserRoles.Administrador,
    } as User;
    const input = {
      userId: mockUser.id,
      courseIds: ['b8a98148-5341-4d8e-a968-d4601ec38522'],
    };

    it('allows an institution administrator to assign courses from the same institution', async () => {
      const target = { ...mockUser, courses: [] };
      const courses = [{ id: input.courseIds[0], user: teacher }] as Course[];
      mockUserRepository.findOne.mockResolvedValue(target);
      mockCourseRepository.find.mockResolvedValue(courses);
      mockUserRepository.save.mockImplementation(async (user) => user);

      const result = await service.assignCourses(input, administrator);

      expect(mockCourseRepository.find).toHaveBeenCalledWith({
        where: {
          id: expect.anything(),
          user: { institutionId },
        },
        relations: ['user'],
      });
      expect(result.courses).toEqual(courses);
    });

    it('allows a teacher to assign only owned courses and preserves other teacher courses', async () => {
      const otherTeacher = {
        ...teacher,
        id: '42f9ae9e-e718-4d33-a229-f7cd8a877db9',
      } as User;
      const otherCourse = {
        id: '74b68ad8-2747-4d3c-af4e-23d67a43d906',
        user: otherTeacher,
      } as Course;
      const ownCourse = { id: input.courseIds[0], user: teacher } as Course;
      const target = { ...mockUser, courses: [otherCourse] };
      mockUserRepository.findOne.mockResolvedValue(target);
      mockCourseRepository.find.mockResolvedValue([ownCourse]);
      mockUserRepository.save.mockImplementation(async (user) => user);

      const result = await service.assignCourses(input, teacher);

      expect(mockCourseRepository.find).toHaveBeenCalledWith({
        where: {
          id: expect.anything(),
          user: { id: teacher.id, institutionId },
        },
        relations: ['user'],
      });
      expect(result.courses).toEqual([otherCourse, ownCourse]);
    });

    it('lets a teacher clear only owned courses without removing other teacher enrollments', async () => {
      const otherTeacher = {
        ...teacher,
        id: '42f9ae9e-e718-4d33-a229-f7cd8a877db9',
      } as User;
      const otherCourse = {
        id: '74b68ad8-2747-4d3c-af4e-23d67a43d906',
        user: otherTeacher,
      } as Course;
      const previousOwnCourse = { id: input.courseIds[0], user: teacher } as Course;
      mockUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        courses: [otherCourse, previousOwnCourse],
      });
      mockCourseRepository.find.mockResolvedValue([]);
      mockUserRepository.save.mockImplementation(async (user) => user);

      const result = await service.assignCourses({ ...input, courseIds: [] }, teacher);

      expect(result.courses).toEqual([otherCourse]);
    });

    it('prevents a teacher from assigning a course owned by another teacher', async () => {
      mockUserRepository.findOne.mockResolvedValue({ ...mockUser, courses: [] });
      mockCourseRepository.find.mockResolvedValue([]);

      await expect(service.assignCourses(input, teacher)).rejects.toBeInstanceOf(
        BadRequestException
      );
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });

    it('prevents a teacher from assigning courses to a cross-institution student', async () => {
      mockUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        institutionId: '46dcda76-9df1-421c-866d-23e95de2e639',
        courses: [],
      });

      await expect(service.assignCourses(input, teacher)).rejects.toBeInstanceOf(
        ForbiddenException
      );
      expect(mockCourseRepository.find).not.toHaveBeenCalled();
    });

    it('prevents a student from assigning courses', async () => {
      await expect(service.assignCourses(input, mockUser)).rejects.toBeInstanceOf(
        ForbiddenException
      );
      expect(mockUserRepository.findOne).not.toHaveBeenCalled();
    });

    it('prevents an institution administrator from assigning courses cross-institution', async () => {
      mockUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        institutionId: '46dcda76-9df1-421c-866d-23e95de2e639',
        courses: [],
      });

      await expect(service.assignCourses(input, administrator)).rejects.toBeInstanceOf(
        ForbiddenException
      );
      expect(mockCourseRepository.find).not.toHaveBeenCalled();
      expect(mockUserRepository.save).not.toHaveBeenCalled();
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
