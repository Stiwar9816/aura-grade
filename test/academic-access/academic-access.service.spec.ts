import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AcademicAccessService } from 'src/academic-access/academic-access.service';
import { User } from 'src/user/entities/user.entity';
import { Course } from 'src/course/entities/course.entity';
import { UserRoles } from 'src/auth/enums';
import { InstitutionApprovalStatus } from 'src/institution';

describe('AcademicAccessService', () => {
  const activeStudent = {
    id: 'student-id',
    role: UserRoles.Estudiante,
    isActive: true,
    approvalStatus: InstitutionApprovalStatus.APPROVED,
    institutionId: 'institution-id',
    institution: { id: 'institution-id', isActive: true },
    email: 'private@example.com',
    originalDraftSnapshot: { private: true },
  };
  const users = { findOne: jest.fn() };
  const courses = { existsBy: jest.fn() };
  const provider = jest.fn(async () => 'respuesta');
  let service: AcademicAccessService;

  beforeEach(async () => {
    jest.resetAllMocks();
    users.findOne.mockResolvedValue({ ...activeStudent });
    courses.existsBy.mockResolvedValue(true);
    provider.mockResolvedValue('respuesta');
    const module = await Test.createTestingModule({
      providers: [
        AcademicAccessService,
        { provide: getRepositoryToken(User), useValue: users },
        { provide: getRepositoryToken(Course), useValue: courses },
      ],
    }).compile();
    service = module.get(AcademicAccessService);
  });

  it('passes only the authorized identifiers to the operation', async () => {
    await expect(service.runForStudentCourse('student-id', 'course-id', provider)).resolves.toBe(
      'respuesta'
    );
    expect(provider).toHaveBeenCalledWith({
      studentId: 'student-id',
      institutionId: 'institution-id',
      courseId: 'course-id',
    });
    expect(courses.existsBy).toHaveBeenCalledWith({
      id: 'course-id',
      users: { id: 'student-id' },
      user: { institutionId: 'institution-id' },
    });
    expect(users.findOne).toHaveBeenCalledWith({
      where: { id: 'student-id' },
      relations: ['institution'],
    });
  });

  it.each([
    ['inactive user', { isActive: false }],
    ['missing activity flag', { isActive: undefined }],
    ['pending approval', { approvalStatus: InstitutionApprovalStatus.PENDING }],
    ['rejected approval', { approvalStatus: InstitutionApprovalStatus.REJECTED }],
    ['missing institution', { institution: undefined }],
    ['disabled institution', { institution: { id: 'institution-id', isActive: false } }],
    ['teacher', { role: UserRoles.Docente }],
    ['administrator', { role: UserRoles.Administrador, isPlatformAdmin: true }],
  ])('never invokes a provider for %s', async (_label, changes) => {
    users.findOne.mockResolvedValue({ ...activeStudent, ...changes });
    await expect(
      service.runForStudentCourse('student-id', 'course-id', provider)
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(provider).not.toHaveBeenCalled();
    expect(courses.existsBy).not.toHaveBeenCalled();
  });

  it('denies deleted users without invoking a provider', async () => {
    users.findOne.mockResolvedValue(null);
    await expect(
      service.runForStudentCourse('student-id', 'course-id', provider)
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(provider).not.toHaveBeenCalled();
  });

  it('denies withdrawn enrollment or a course outside the institution', async () => {
    courses.existsBy.mockResolvedValue(false);
    await expect(
      service.runForStudentCourse('student-id', 'course-id', provider)
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(provider).not.toHaveBeenCalled();
  });

  it('rechecks deactivation and reactivation without retaining authorization', async () => {
    await service.runForStudentCourse('student-id', 'course-id', provider);
    users.findOne.mockResolvedValue({ ...activeStudent, isActive: false });
    await expect(
      service.runForStudentCourse('student-id', 'course-id', provider)
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(provider).toHaveBeenCalledTimes(1);
    users.findOne.mockResolvedValue(activeStudent);
    await service.runForStudentCourse('student-id', 'course-id', provider);
    expect(provider).toHaveBeenCalledTimes(2);
  });

  it('rechecks enrollment on the next operation', async () => {
    await service.runForStudentCourse('student-id', 'course-id', provider);
    courses.existsBy.mockResolvedValue(false);
    await expect(
      service.runForStudentCourse('student-id', 'course-id', provider)
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it.each(['user', 'course'])(
    'fails closed when the %s repository is unavailable',
    async (repository) => {
      const error = new Error('Database unavailable');
      if (repository === 'user') users.findOne.mockRejectedValue(error);
      else courses.existsBy.mockRejectedValue(error);
      await expect(
        service.runForStudentCourse('student-id', 'course-id', provider)
      ).rejects.toThrow('Database unavailable');
      expect(provider).not.toHaveBeenCalled();
    }
  );

  it('rejects empty identifiers before TypeORM can ignore them', async () => {
    await expect(service.runForStudentCourse('', 'course-id', provider)).rejects.toBeInstanceOf(
      ForbiddenException
    );
    await expect(service.runForStudentCourse('student-id', '', provider)).rejects.toBeInstanceOf(
      ForbiddenException
    );
    expect(provider).not.toHaveBeenCalled();
    expect(courses.existsBy).not.toHaveBeenCalled();
  });
});
