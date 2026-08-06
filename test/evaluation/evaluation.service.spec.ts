import { EvaluationService } from 'src/evaluation/evaluation.service';
import { UserRoles } from 'src/auth/enums';
import { EvaluationStatus, SubmissionStatus } from 'src/enums';
import type { User } from 'src/user/entities/user.entity';

describe('EvaluationService', () => {
  const evaluationRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };
  const submissionRepository = {
    findOneBy: jest.fn(),
    update: jest.fn(),
  };
  const notificationsGateway = { notifyStudent: jest.fn() };
  const notificationQueue = { enqueuePublishedGrade: jest.fn() };
  const service = new EvaluationService(
    evaluationRepository as never,
    submissionRepository as never,
    notificationsGateway as never,
    notificationQueue as never
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
  const assignment = {
    id: 'assignment-id',
    title: 'Ensayo',
    user: teacher,
    rubric: { maxTotalScore: 10 },
  };
  const draftEvaluation = {
    id: 'evaluation-id',
    totalScore: 8,
    generalFeedback: 'Buen trabajo',
    detailedFeedback: {},
    status: EvaluationStatus.DRAFT,
    submission: {
      id: 'submission-id',
      student,
      assignment,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    notificationQueue.enqueuePublishedGrade.mockResolvedValue('grade-published-evaluation-id');
  });

  it('creates an internal draft and marks the submission for teacher review', async () => {
    submissionRepository.findOneBy.mockResolvedValue({ id: 'submission-id' });
    evaluationRepository.findOne.mockResolvedValue(null);
    evaluationRepository.create.mockImplementation((value) => value);
    evaluationRepository.save.mockImplementation((value) => ({ ...value, id: 'evaluation-id' }));

    const result = await service.createDraft({
      submissionId: 'submission-id',
      totalScore: 8,
      generalFeedback: 'Buen trabajo',
      detailedFeedback: {},
    });

    expect(evaluationRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        submission: { id: 'submission-id' },
        status: EvaluationStatus.DRAFT,
      })
    );
    expect(submissionRepository.update).toHaveBeenCalledWith('submission-id', {
      status: SubmissionStatus.REVIEW_PENDING,
    });
    expect(result.id).toBe('evaluation-id');
  });

  it('reuses the existing draft when the grading job is retried', async () => {
    submissionRepository.findOneBy.mockResolvedValue({ id: 'submission-id' });
    evaluationRepository.findOne.mockResolvedValue(draftEvaluation);

    const result = await service.createDraft({
      submissionId: 'submission-id',
      totalScore: 8,
      generalFeedback: 'Buen trabajo',
      detailedFeedback: {},
    });

    expect(result).toBe(draftEvaluation);
    expect(evaluationRepository.save).not.toHaveBeenCalled();
  });

  it('scopes evaluation listings by role and hides drafts from students', async () => {
    evaluationRepository.find.mockResolvedValue([]);

    await service.findAll(teacher);
    expect(evaluationRepository.find).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { submission: { assignment: { user: { id: teacher.id } } } },
      })
    );

    await service.findAll(student);
    expect(evaluationRepository.find).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          status: EvaluationStatus.PUBLISHED,
          submission: { student: { id: student.id } },
        },
      })
    );

    const administrator = {
      id: 'admin-id',
      role: UserRoles.Administrador,
      institutionId: 'institution-id',
      isPlatformAdmin: false,
    } as User;
    await service.findAll(administrator);
    expect(evaluationRepository.find).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          submission: {
            assignment: { user: { institutionId: administrator.institutionId } },
          },
        },
      })
    );
  });

  it('does not expose a draft evaluation to its student', async () => {
    evaluationRepository.findOne.mockResolvedValue(draftEvaluation);

    await expect(service.findOne(draftEvaluation.id, student)).rejects.toThrow(
      'No puedes acceder a esta evaluación.'
    );
  });

  it('allows a student to read only their own published evaluation', async () => {
    evaluationRepository.findOne.mockResolvedValue({
      ...draftEvaluation,
      status: EvaluationStatus.PUBLISHED,
    });

    await expect(service.findOne(draftEvaluation.id, student)).resolves.toEqual(
      expect.objectContaining({ status: EvaluationStatus.PUBLISHED })
    );
  });

  it('rejects publishing an evaluation from another teacher task', async () => {
    evaluationRepository.findOne.mockResolvedValue({
      ...draftEvaluation,
      submission: {
        ...draftEvaluation.submission,
        assignment: { ...assignment, user: { id: 'other-teacher-id' } },
      },
    });

    await expect(service.publish(draftEvaluation.id, undefined, teacher)).rejects.toThrow(
      'Solo el docente propietario de la tarea'
    );
    expect(evaluationRepository.save).not.toHaveBeenCalled();
  });

  it('rejects a score above the rubric maximum', async () => {
    evaluationRepository.findOne.mockResolvedValue(draftEvaluation);

    await expect(
      service.publish(
        draftEvaluation.id,
        { id: draftEvaluation.id, totalScore: 11, generalFeedback: 'Revisada' },
        teacher
      )
    ).rejects.toThrow('La calificación debe estar entre 0 y 10.');
  });

  it('publishes and notifies using the complete student, assignment and evaluation entities', async () => {
    evaluationRepository.findOne.mockResolvedValue({ ...draftEvaluation });
    evaluationRepository.save.mockImplementation((value) => value);

    const result = await service.publish(
      draftEvaluation.id,
      { id: draftEvaluation.id, totalScore: 9, generalFeedback: 'Revisión final' },
      teacher
    );

    expect(result.status).toBe(EvaluationStatus.PUBLISHED);
    expect(submissionRepository.update).toHaveBeenCalledWith('submission-id', {
      status: SubmissionStatus.PUBLISHED,
    });
    expect(notificationsGateway.notifyStudent).toHaveBeenCalledWith(
      student.id,
      expect.objectContaining({ evaluationId: draftEvaluation.id })
    );
    expect(notificationQueue.enqueuePublishedGrade).toHaveBeenCalledWith(result.id);
  });

  it('keeps a published grade when notification queueing fails', async () => {
    evaluationRepository.findOne.mockResolvedValue({
      ...draftEvaluation,
      totalScore: 8,
      submission: {
        ...draftEvaluation.submission,
        assignment: { ...assignment, rubric: { maxTotalScore: 10 } },
      },
    });
    evaluationRepository.save.mockImplementation((value) => value);
    notificationQueue.enqueuePublishedGrade.mockRejectedValueOnce(new Error('Queue unavailable'));

    await expect(service.publish(draftEvaluation.id, undefined, teacher)).resolves.toEqual(
      expect.objectContaining({ status: EvaluationStatus.PUBLISHED })
    );
  });
});
