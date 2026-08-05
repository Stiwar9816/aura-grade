import { ReEvaluationService } from 'src/reevaluation/reevaluation.service';
import { UserRoles } from 'src/auth/enums';
import { EvaluationStatus, ReEvaluationStatus, SubmissionStatus } from 'src/enums';
import type { User } from 'src/user/entities/user.entity';

describe('ReEvaluationService', () => {
  const requestRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };
  const evaluationRepository = { findOne: jest.fn() };
  const service = new ReEvaluationService(
    requestRepository as never,
    evaluationRepository as never
  );

  const teacher = {
    id: 'teacher-id',
    role: UserRoles.Docente,
    institutionId: 'institution-id',
    isPlatformAdmin: false,
  } as User;
  const student = {
    id: 'student-id',
    role: UserRoles.Estudiante,
    institutionId: 'institution-id',
    isPlatformAdmin: false,
  } as User;
  const evaluation = {
    id: 'evaluation-id',
    status: EvaluationStatus.PUBLISHED,
    submission: {
      id: 'submission-id',
      status: SubmissionStatus.PUBLISHED,
      student,
      assignment: {
        id: 'assignment-id',
        user: teacher,
        course: { user: teacher },
      },
    },
  };
  const request = {
    id: 'request-id',
    reason: 'Necesito una revisión detallada de la nota.',
    status: ReEvaluationStatus.PENDING,
    evaluation,
    student,
    teacher,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a request for the owner of a published evaluation', async () => {
    evaluationRepository.findOne.mockResolvedValue(evaluation);
    requestRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(request);
    requestRepository.create.mockImplementation((value) => value);
    requestRepository.save.mockResolvedValue({ id: request.id });

    const result = await service.create(
      {
        evaluationId: evaluation.id,
        reason: '  Necesito una revisión detallada de la nota.  ',
      },
      student
    );

    expect(requestRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'Necesito una revisión detallada de la nota.',
        status: ReEvaluationStatus.PENDING,
        student: { id: student.id },
        teacher: { id: teacher.id },
      })
    );
    expect(result).toBe(request);
  });

  it('rejects creating a request for another student evaluation', async () => {
    evaluationRepository.findOne.mockResolvedValue({
      ...evaluation,
      submission: {
        ...evaluation.submission,
        student: { id: 'other-student-id' },
      },
    });

    await expect(
      service.create(
        {
          evaluationId: evaluation.id,
          reason: 'Solicito revisar detalladamente esta calificación.',
        },
        student
      )
    ).rejects.toThrow('Solo el propietario de la entrega');
  });

  it('rejects requests for draft evaluations', async () => {
    evaluationRepository.findOne.mockResolvedValue({
      ...evaluation,
      status: EvaluationStatus.DRAFT,
    });

    await expect(
      service.create(
        {
          evaluationId: evaluation.id,
          reason: 'Solicito revisar detalladamente esta calificación.',
        },
        student
      )
    ).rejects.toThrow('evaluaciones publicadas');
  });

  it('enforces the trimmed reason length in the service', async () => {
    await expect(
      service.create({ evaluationId: evaluation.id, reason: '       muy corto       ' }, student)
    ).rejects.toThrow('entre 20 y 2000 caracteres');
    expect(evaluationRepository.findOne).not.toHaveBeenCalled();
  });

  it('scopes listings for administrator, teacher and student', async () => {
    requestRepository.find.mockResolvedValue([]);
    const administrator = {
      id: 'admin-id',
      role: UserRoles.Administrador,
      institutionId: 'institution-id',
      isPlatformAdmin: false,
    } as User;

    await service.findAll(administrator);
    expect(requestRepository.find).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          evaluation: {
            submission: {
              assignment: { user: { institutionId: administrator.institutionId } },
            },
          },
        },
      })
    );

    await service.findAll(teacher);
    expect(requestRepository.find).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { evaluation: { submission: { assignment: { user: { id: teacher.id } } } } },
      })
    );

    await service.findAll(student);
    expect(requestRepository.find).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { student: { id: student.id } } })
    );
  });

  it('rejects an administrator from resolving a request', async () => {
    const administrator = {
      id: 'admin-id',
      role: UserRoles.Administrador,
      institutionId: 'institution-id',
      isPlatformAdmin: false,
    } as User;
    requestRepository.findOne.mockResolvedValue({ ...request });

    await expect(
      service.resolve(
        {
          id: request.id,
          status: ReEvaluationStatus.APPROVED,
          teacherResponse: 'Se revisó la solicitud y la calificación.',
        },
        administrator
      )
    ).rejects.toThrow('Solo el docente propietario de la tarea');
  });

  it('rejects another teacher from accessing the request', async () => {
    const otherTeacher = {
      id: 'other-teacher-id',
      role: UserRoles.Docente,
      institutionId: 'institution-id',
      isPlatformAdmin: false,
    } as User;
    requestRepository.findOne.mockResolvedValue({ ...request });

    await expect(
      service.resolve(
        {
          id: request.id,
          status: ReEvaluationStatus.REJECTED,
          teacherResponse: 'La calificación se mantiene después de revisarla.',
        },
        otherTeacher
      )
    ).rejects.toThrow('No tienes acceso a esta solicitud');
  });

  it('allows the task owner to resolve with a trimmed response', async () => {
    const pendingRequest = { ...request };
    requestRepository.findOne.mockResolvedValue(pendingRequest);
    requestRepository.save.mockImplementation((value) => value);

    const result = await service.resolve(
      {
        id: request.id,
        status: ReEvaluationStatus.APPROVED,
        teacherResponse: '  Revisé nuevamente la entrega y ajusté la nota.  ',
      },
      teacher
    );

    expect(result.status).toBe(ReEvaluationStatus.APPROVED);
    expect(result.teacherResponse).toBe('Revisé nuevamente la entrega y ajusté la nota.');
    expect(result.reviewedAt).toBeInstanceOf(Date);
  });
});
