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
  const extensionRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
  };
  const courseRepository = { findOne: jest.fn() };
  const rubricRepository = { findOne: jest.fn() };
  const service = new AssignmentService(
    assignmentRepository as never,
    extensionRepository as never,
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
        dueDate: new Date('2026-08-16T12:00:00.000Z'),
        extensions: [
          {
            extendedDueDate: new Date('2026-08-18T12:00:00.000Z'),
            student: { id: 'student-id' },
          },
          {
            extendedDueDate: new Date('2026-08-20T12:00:00.000Z'),
            student: { id: 'other-student-id' },
          },
        ],
      },
    ]);

    const result = await service.findAll(student);

    expect(result[0].submissions).toEqual([
      { id: 'own-submission', student: { id: 'student-id' } },
    ]);
    expect(result[0].course.users).toEqual([{ id: 'student-id' }]);
    expect(result[0].effectiveDueDate).toEqual(new Date('2026-08-18T12:00:00.000Z'));
    expect(result[0].extensions).toHaveLength(1);
  });

  it('hides draft evaluation details from the authenticated student', async () => {
    const student = { id: 'student-id', role: UserRoles.Estudiante } as User;
    assignmentRepository.find.mockResolvedValue([
      {
        id: 'assignment-id',
        course: { users: [student] },
        submissions: [
          {
            id: 'submission-id',
            student,
            gradingAttemptCount: 3,
            gradingFailureReason: 'El servicio de IA no pudo completar la evaluación.',
            gradingLastAttemptAt: new Date('2026-08-15T14:30:00.000Z'),
            evaluation: { id: 'evaluation-id', status: 'DRAFT', totalScore: 5 },
          },
        ],
      },
    ]);

    const [assignment] = await service.findAll(student);

    expect(assignment.submissions?.[0].evaluation).toBeUndefined();
    expect(assignment.submissions?.[0].gradingAttemptCount).toBeUndefined();
    expect(assignment.submissions?.[0].gradingFailureReason).toBeUndefined();
    expect(assignment.submissions?.[0].gradingLastAttemptAt).toBeUndefined();
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

  it('creates an individual extension for an active enrolled student without a submission', async () => {
    const student = {
      id: 'student-id',
      role: UserRoles.Estudiante,
      isActive: true,
    } as User;
    const assignment = {
      id: 'assignment-id',
      dueDate: new Date(Date.now() + 60_000),
      isActive: true,
      user: teacher,
      course: { users: [student] },
      submissions: [],
      extensions: [],
    };
    assignmentRepository.findOne.mockResolvedValue(assignment);
    extensionRepository.findOne.mockResolvedValue(null);
    extensionRepository.create.mockReturnValue({});
    extensionRepository.save.mockImplementation((value) => ({ id: 'extension-id', ...value }));
    const extendedDueDate = new Date(Date.now() + 120_000);

    await expect(
      service.upsertExtension(
        {
          assignmentId: assignment.id,
          studentId: student.id,
          extendedDueDate,
          reason: 'Incapacidad médica',
        },
        teacher
      )
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'extension-id',
        student,
        grantedBy: teacher,
        extendedDueDate,
        reason: 'Incapacidad médica',
      })
    );
  });

  it('rejects extending an assignment already submitted by the student', async () => {
    const student = {
      id: 'student-id',
      role: UserRoles.Estudiante,
      isActive: true,
    } as User;
    assignmentRepository.findOne.mockResolvedValue({
      id: 'assignment-id',
      dueDate: new Date(Date.now() + 60_000),
      isActive: true,
      user: teacher,
      course: { users: [student] },
      submissions: [{ student }],
      extensions: [],
    });

    await expect(
      service.upsertExtension(
        {
          assignmentId: 'assignment-id',
          studentId: student.id,
          extendedDueDate: new Date(Date.now() + 120_000),
        },
        teacher
      )
    ).rejects.toThrow('ya entregó');
    expect(extensionRepository.save).not.toHaveBeenCalled();
  });

  it('rejects extending an inactive assignment', async () => {
    const student = {
      id: 'student-id',
      role: UserRoles.Estudiante,
      isActive: true,
    } as User;
    assignmentRepository.findOne.mockResolvedValue({
      id: 'assignment-id',
      dueDate: new Date(Date.now() + 60_000),
      isActive: false,
      user: teacher,
      course: { users: [student] },
      submissions: [],
      extensions: [],
    });

    await expect(
      service.upsertExtension(
        {
          assignmentId: 'assignment-id',
          studentId: student.id,
          extendedDueDate: new Date(Date.now() + 120_000),
        },
        teacher
      )
    ).rejects.toThrow('tarea inactiva');
  });
});
