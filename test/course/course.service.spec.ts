import { CourseService } from 'src/course/course.service';
import { UserRoles } from 'src/auth/enums';
import type { User } from 'src/user/entities/user.entity';

describe('CourseService', () => {
  const courseRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    preload: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };
  const service = new CourseService(courseRepository as never);

  beforeEach(() => {
    jest.clearAllMocks();
    courseRepository.find.mockResolvedValue([]);
  });

  it.each([
    {
      role: UserRoles.Docente,
      expectedWhere: { user: { id: 'teacher-id' } },
    },
    {
      role: UserRoles.Administrador,
      expectedWhere: { user: { institutionId: 'institution-id' } },
    },
    {
      role: UserRoles.Estudiante,
      expectedWhere: { users: { id: 'teacher-id' } },
    },
  ])('limits course listing for $role', async ({ role, expectedWhere }) => {
    const actor = {
      id: 'teacher-id',
      role,
      institutionId: 'institution-id',
      isPlatformAdmin: false,
    } as User;

    await service.findAll(actor);

    expect(courseRepository.find).toHaveBeenCalledWith({
      where: expectedWhere,
      relations: ['users', 'user'],
    });
  });

  it('allows a platform administrator to list all courses', async () => {
    const actor = {
      id: 'platform-admin-id',
      role: UserRoles.Administrador,
      institutionId: 'platform-institution-id',
      isPlatformAdmin: true,
    } as User;

    await service.findAll(actor);

    expect(courseRepository.find).toHaveBeenCalledWith({
      where: undefined,
      relations: ['users', 'user'],
    });
  });

  it('rejects enrollment changes through the generic course update', async () => {
    const teacher = {
      id: 'teacher-id',
      role: UserRoles.Docente,
    } as User;

    await expect(
      service.update('course-id', { id: 'course-id', studentsIds: ['student-id'] }, teacher)
    ).rejects.toThrow('assignCoursesToUser');
    expect(courseRepository.preload).not.toHaveBeenCalled();
  });

  it('rejects access to a course owned by another teacher', async () => {
    const teacher = {
      id: 'teacher-id',
      role: UserRoles.Docente,
      institutionId: 'institution-id',
    } as User;
    courseRepository.findOne.mockResolvedValue({
      id: 'course-id',
      user: { id: 'other-teacher-id', institutionId: 'institution-id' },
      users: [],
    });

    await expect(service.findOne('course-id', teacher)).rejects.toThrow(
      'No puedes acceder a este curso.'
    );
  });
});
