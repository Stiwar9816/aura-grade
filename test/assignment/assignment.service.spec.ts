import { AssignmentService } from 'src/assignment/assignment.service';
import { UserRoles } from 'src/auth/enums';
import type { User } from 'src/user/entities/user.entity';

describe('AssignmentService', () => {
  const assignmentRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    preload: jest.fn(),
    remove: jest.fn(),
  };
  const courseRepository = { findOne: jest.fn() };
  const rubricRepository = { findOne: jest.fn() };
  const service = new AssignmentService(
    assignmentRepository as never,
    courseRepository as never,
    rubricRepository as never
  );

  const teacher = {
    id: 'teacher-id',
    role: UserRoles.Docente,
    institutionId: 'institution-id',
  } as User;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('scopes teacher assignment listing to the authenticated owner', async () => {
    assignmentRepository.find.mockResolvedValue([]);

    await service.findAll(teacher);

    expect(assignmentRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true, user: { id: teacher.id } },
      })
    );
  });

  it('scopes administrator listing to the institution', async () => {
    assignmentRepository.find.mockResolvedValue([]);
    const administrator = {
      id: 'admin-id',
      role: UserRoles.Administrador,
      institutionId: 'institution-id',
    } as User;

    await service.findAll(administrator);

    expect(assignmentRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true, user: { institutionId: 'institution-id' } },
      })
    );
  });

  it('returns only the authenticated student submission', async () => {
    const student = { id: 'student-id', role: UserRoles.Estudiante } as User;
    assignmentRepository.find.mockResolvedValue([
      {
        id: 'assignment-id',
        course: {
          users: [{ id: 'student-id' }, { id: 'other-student-id' }],
        },
        submissions: [
          { id: 'own-submission', student: { id: 'student-id' } },
          { id: 'other-submission', student: { id: 'other-student-id' } },
        ],
      },
    ]);

    const result = await service.findAll(student);

    expect(result[0].submissions).toEqual([
      { id: 'own-submission', student: { id: 'student-id' } },
    ]);
    expect(result[0].course.users).toEqual([{ id: 'student-id' }]);
  });

  it('creates the assignment under the authenticated teacher identity', async () => {
    const course = { id: 'course-id', user: teacher };
    const rubric = { id: 'rubric-id', user: teacher };
    courseRepository.findOne.mockResolvedValue(course);
    rubricRepository.findOne.mockResolvedValue(rubric);
    assignmentRepository.create.mockImplementation((value) => value);
    assignmentRepository.save.mockResolvedValue({ id: 'assignment-id' });
    assignmentRepository.findOne.mockResolvedValue({
      id: 'assignment-id',
      user: teacher,
      course: { ...course, users: [] },
      rubric,
      submissions: [],
      isActive: true,
    });

    await service.create(
      {
        title: 'Tarea',
        description: 'Descripción',
        dueDate: new Date(),
        courseId: 'course-id',
        rubricId: 'rubric-id',
      },
      teacher
    );

    expect(assignmentRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Tarea',
        user: teacher,
        course,
        rubric,
      })
    );
  });

  it('rejects reading an assignment owned by another teacher', async () => {
    assignmentRepository.findOne.mockResolvedValue({
      id: 'assignment-id',
      user: { id: 'other-teacher-id' },
      course: { users: [] },
    });

    await expect(service.findOne('assignment-id', teacher)).rejects.toThrow(
      'No puedes acceder a esta tarea.'
    );
  });

  it('rejects creating an assignment with another teacher course', async () => {
    courseRepository.findOne.mockResolvedValue(null);
    rubricRepository.findOne.mockResolvedValue({ id: 'rubric-id', user: teacher });

    await expect(
      service.create(
        {
          title: 'Tarea',
          description: 'Descripción',
          dueDate: new Date(),
          courseId: 'course-id',
          rubricId: 'rubric-id',
          isActive: true,
        },
        teacher
      )
    ).rejects.toThrow('no pertenece al docente actual');
  });

  it('prevents an administrator from creating assignments', async () => {
    const administrator = {
      id: 'admin-id',
      role: UserRoles.Administrador,
    } as User;

    await expect(
      service.create(
        {
          title: 'Tarea',
          description: 'Descripción',
          dueDate: new Date(),
          courseId: 'course-id',
          rubricId: 'rubric-id',
        },
        administrator
      )
    ).rejects.toThrow('Solo un docente puede administrar tareas.');
  });
});
