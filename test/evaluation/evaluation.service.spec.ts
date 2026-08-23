import { EvaluationService } from 'src/evaluation/evaluation.service';
import { UserRoles } from 'src/auth/enums';
import { EvaluationOrigin, EvaluationStatus, SubmissionStatus } from 'src/enums';
import type { User } from 'src/user/entities/user.entity';
import { Submission } from 'src/submission/entities/submission.entity';

describe('EvaluationService', () => {
  const evaluationRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };
  const submissionRepository = {
    findOneBy: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };
  const manager = {
    getRepository: jest.fn((entity) =>
      entity === Submission ? submissionRepository : evaluationRepository
    ),
  };
  const dataSource = { transaction: jest.fn((callback) => callback(manager)) };
  const notificationsGateway = { notifyStudent: jest.fn() };
  const notificationQueue = { enqueuePublishedGrade: jest.fn() };
  const gradingQueue = { getJobs: jest.fn() };
  const service = new EvaluationService(
    evaluationRepository as never,
    submissionRepository as never,
    dataSource as never,
    notificationsGateway as never,
    notificationQueue as never,
    gradingQueue as never
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
    rubric: {
      maxTotalScore: 5,
      criteria: [{ id: 'criterion-id', title: 'Argumentación', weight: 100 }],
    },
  };
  const draftEvaluation = {
    id: 'evaluation-id',
    totalScore: 4,
    generalFeedback: 'Buen trabajo',
    detailedFeedback: {},
    status: EvaluationStatus.DRAFT,
    origin: EvaluationOrigin.AI,
    submission: {
      id: 'submission-id',
      student,
      assignment,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    notificationQueue.enqueuePublishedGrade.mockResolvedValue('grade-published-evaluation-id');
    gradingQueue.getJobs.mockResolvedValue([]);
    manager.getRepository.mockImplementation((entity) =>
      entity === Submission ? submissionRepository : evaluationRepository
    );
    dataSource.transaction.mockImplementation((callback) => callback(manager));
  });

  it('creates an internal draft and marks the submission for teacher review', async () => {
    submissionRepository.findOne.mockResolvedValue({ id: 'submission-id' });
    evaluationRepository.findOne.mockResolvedValue(null);
    evaluationRepository.create.mockImplementation((value) => value);
    evaluationRepository.save.mockImplementation((value) => ({ ...value, id: 'evaluation-id' }));

    const result = await service.createDraft({
      submissionId: 'submission-id',
      totalScore: 4,
      generalFeedback: 'Buen trabajo',
      detailedFeedback: {},
    });

    expect(evaluationRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        submission: { id: 'submission-id' },
        status: EvaluationStatus.DRAFT,
        origin: EvaluationOrigin.AI,
      })
    );
    expect(submissionRepository.update).toHaveBeenCalledWith('submission-id', {
      status: SubmissionStatus.REVIEW_PENDING,
    });
    expect(result.id).toBe('evaluation-id');
  });

  it('reuses the existing draft when the grading job is retried', async () => {
    submissionRepository.findOne.mockResolvedValue({ id: 'submission-id' });
    evaluationRepository.findOne.mockResolvedValue(draftEvaluation);

    const result = await service.createDraft({
      submissionId: 'submission-id',
      totalScore: 4,
      generalFeedback: 'Buen trabajo',
      detailedFeedback: {},
    });

    expect(result).toBe(draftEvaluation);
    expect(evaluationRepository.save).not.toHaveBeenCalled();
  });

  it('creates a manual draft only for the owner of a failed submission', async () => {
    submissionRepository.findOne.mockResolvedValue({
      id: 'submission-id',
      status: SubmissionStatus.FAILED,
      assignment,
    });
    evaluationRepository.findOne.mockResolvedValue(null);
    evaluationRepository.create.mockImplementation((value) => value);
    evaluationRepository.save.mockImplementation((value) => ({ ...value, id: 'manual-id' }));
    const remove = jest.fn().mockResolvedValue(undefined);
    gradingQueue.getJobs.mockResolvedValue([
      { data: { id: 'submission-id' }, remove },
      { data: { id: 'other-submission' }, remove: jest.fn() },
    ]);

    const result = await service.createManualDraft(
      {
        submissionId: 'submission-id',
        totalScore: 4,
        generalFeedback: 'Revisión manual completa',
        detailedFeedback: [{ criteriaId: 'criterion-id', score: 4 }],
      },
      teacher
    );

    expect(result).toEqual(
      expect.objectContaining({ id: 'manual-id', origin: EvaluationOrigin.MANUAL })
    );
    expect(evaluationRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        totalScore: 4,
        origin: EvaluationOrigin.MANUAL,
        status: EvaluationStatus.DRAFT,
        submission: { id: 'submission-id' },
      })
    );
    expect(submissionRepository.update).toHaveBeenCalledWith('submission-id', {
      status: SubmissionStatus.REVIEW_PENDING,
    });
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('rejects manual grading when the submission belongs to another teacher', async () => {
    submissionRepository.findOne.mockResolvedValue({
      id: 'submission-id',
      status: SubmissionStatus.FAILED,
      assignment: { ...assignment, user: { id: 'other-teacher-id' } },
    });

    await expect(
      service.createManualDraft(
        {
          submissionId: 'submission-id',
          totalScore: 4,
          generalFeedback: 'Revisión manual',
        },
        teacher
      )
    ).rejects.toThrow('otro docente');
    expect(evaluationRepository.save).not.toHaveBeenCalled();
  });

  it('rejects manual grading while an AI retry owns the submission', async () => {
    submissionRepository.findOne.mockResolvedValue({
      id: 'submission-id',
      status: SubmissionStatus.PENDING,
      assignment,
    });
    evaluationRepository.findOne.mockResolvedValue(null);

    await expect(
      service.createManualDraft(
        {
          submissionId: 'submission-id',
          totalScore: 4,
          generalFeedback: 'Revisión manual',
        },
        teacher
      )
    ).rejects.toThrow('entrega fallida');
  });

  it('reuses an existing manual draft idempotently', async () => {
    const manualDraft = { ...draftEvaluation, origin: EvaluationOrigin.MANUAL };
    submissionRepository.findOne.mockResolvedValue({
      id: 'submission-id',
      status: SubmissionStatus.REVIEW_PENDING,
      assignment,
    });
    evaluationRepository.findOne.mockResolvedValue(manualDraft);

    await expect(
      service.createManualDraft(
        {
          submissionId: 'submission-id',
          totalScore: 4,
          generalFeedback: 'Revisión manual',
        },
        teacher
      )
    ).resolves.toBe(manualDraft);
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
        { id: draftEvaluation.id, totalScore: 5.1, generalFeedback: 'Revisada' },
        teacher
      )
    ).rejects.toThrow('La calificación debe estar entre 0 y 5.');
  });

  it('publishes and notifies using the complete student, assignment and evaluation entities', async () => {
    evaluationRepository.findOne.mockResolvedValue({ ...draftEvaluation });
    evaluationRepository.save.mockImplementation((value) => value);

    const result = await service.publish(
      draftEvaluation.id,
      { id: draftEvaluation.id, totalScore: 4.5, generalFeedback: 'Revisión final' },
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
      totalScore: 4,
      submission: {
        ...draftEvaluation.submission,
        assignment: { ...assignment, rubric: { maxTotalScore: 5 } },
      },
    });
    evaluationRepository.save.mockImplementation((value) => value);
    notificationQueue.enqueuePublishedGrade.mockRejectedValueOnce(new Error('Queue unavailable'));

    await expect(service.publish(draftEvaluation.id, undefined, teacher)).resolves.toEqual(
      expect.objectContaining({ status: EvaluationStatus.PUBLISHED })
    );
  });
});
