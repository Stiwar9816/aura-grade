import { NotificationDeliveryEntity } from 'src/notifications/entities/notification-delivery.entity';
import {
  AssignmentReminderKind,
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationJobType,
  notificationEventKey,
} from 'src/notifications/notification-queue.constants';
import { NotificationProcessor } from 'src/notifications/notification.processor';
import { UserRoles } from 'src/auth/enums';
import { EvaluationStatus, SubmissionStatus } from 'src/enums';
import { InstitutionApprovalStatus } from 'src/institution';

const academicStudent = {
  role: UserRoles.Estudiante,
  isActive: true,
  approvalStatus: InstitutionApprovalStatus.APPROVED,
  institutionId: 'institution-id',
  institution: { id: 'institution-id', isActive: true },
};
const courseOwner = { institutionId: 'institution-id' };

describe('NotificationProcessor', () => {
  const submission = {
    id: 'submission-id',
    status: SubmissionStatus.FAILED,
    gradingAttemptCount: 3,
    gradingFailureReason: 'El servicio de IA no pudo completar la evaluación.',
    student: { ...academicStudent, id: 'student-id', name: 'Ana', last_name: 'Pérez' },
    assignment: {
      id: 'assignment-id',
      title: 'Ensayo',
      user: { id: 'teacher-id' },
      course: { user: courseOwner, users: [{ id: 'student-id' }] },
    },
  } as any;
  const evaluation = {
    id: 'evaluation-id',
    status: EvaluationStatus.PUBLISHED,
    totalScore: 4.5,
    submission,
  } as any;
  const submissionRepository = { findOne: jest.fn() };
  const evaluationRepository = { findOne: jest.fn() };
  const assignmentRepository = { find: jest.fn(), findOne: jest.fn() };
  const deliveryRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const notificationsService = {
    createNewSubmissionInApp: jest.fn(),
    createPublishedGradeInApp: jest.fn(),
    createGradingFailedInApp: jest.fn(),
    sendNewSubmissionEmail: jest.fn(),
    sendNewSubmissionPush: jest.fn(),
    sendPublishedGradeEmail: jest.fn(),
    sendPublishedGradePush: jest.fn(),
    createAssignmentReminderInApp: jest.fn(),
    sendAssignmentReminderEmail: jest.fn(),
    sendAssignmentReminderPush: jest.fn(),
  };
  const notificationQueue = { enqueueAssignmentReminder: jest.fn() };
  const metrics = { increment: jest.fn() };
  const deliveries: NotificationDeliveryEntity[] = [];
  const processor = new NotificationProcessor(
    submissionRepository as any,
    evaluationRepository as any,
    assignmentRepository as any,
    deliveryRepository as any,
    notificationsService as any,
    notificationQueue as any,
    metrics as any
  );

  const makeJob = (type: NotificationJobType, aggregateId: string) => ({
    id: notificationEventKey(type, aggregateId),
    data: {
      type,
      aggregateId,
      eventKey: notificationEventKey(type, aggregateId),
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    deliveries.length = 0;
    submissionRepository.findOne.mockResolvedValue(submission);
    evaluationRepository.findOne.mockResolvedValue(evaluation);
    notificationsService.createNewSubmissionInApp.mockResolvedValue(true);
    notificationsService.createPublishedGradeInApp.mockResolvedValue(true);
    notificationsService.createGradingFailedInApp.mockResolvedValue(true);
    notificationsService.sendNewSubmissionEmail.mockResolvedValue(true);
    notificationsService.sendNewSubmissionPush.mockResolvedValue(true);
    notificationsService.sendPublishedGradeEmail.mockResolvedValue(true);
    notificationsService.sendPublishedGradePush.mockResolvedValue(true);
    notificationsService.createAssignmentReminderInApp.mockResolvedValue(true);
    notificationsService.sendAssignmentReminderEmail.mockResolvedValue(true);
    notificationsService.sendAssignmentReminderPush.mockResolvedValue(true);
    notificationQueue.enqueueAssignmentReminder.mockResolvedValue({
      eventKey: 'reminder-key',
      queued: true,
    });
    deliveryRepository.findOne.mockImplementation(({ where }) =>
      Promise.resolve(
        deliveries.find(
          (delivery) => delivery.eventKey === where.eventKey && delivery.channel === where.channel
        ) ?? null
      )
    );
    deliveryRepository.create.mockImplementation((value) => ({ ...value }));
    deliveryRepository.save.mockImplementation((value) => {
      const saved = {
        ...value,
        id: value.id ?? `delivery-${deliveries.length + 1}`,
        updatedAt: new Date(),
      } as NotificationDeliveryEntity;
      const index = deliveries.findIndex((delivery) => delivery.id === saved.id);
      if (index >= 0) deliveries[index] = saved;
      else deliveries.push(saved);
      return Promise.resolve({ ...saved });
    });
  });

  it('delivers both channels and stores their terminal state', async () => {
    const result = await processor.process(
      makeJob(NotificationJobType.NEW_SUBMISSION, submission.id) as any
    );

    expect(result).toEqual({
      status: 'DELIVERED',
      channels: {
        EMAIL: NotificationDeliveryStatus.SENT,
        PUSH: NotificationDeliveryStatus.SENT,
      },
    });
    expect(notificationsService.sendNewSubmissionEmail).toHaveBeenCalledWith(
      submission.assignment.user,
      submission.student,
      submission.assignment,
      'new-submission-submission-id-email'
    );
    expect(notificationsService.createNewSubmissionInApp).toHaveBeenCalledWith(
      submission.assignment.user,
      submission.student,
      submission.assignment,
      submission.id
    );
    expect(deliveries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ channel: NotificationChannel.EMAIL, status: 'SENT' }),
        expect.objectContaining({ channel: NotificationChannel.PUSH, status: 'SENT' }),
      ])
    );
  });

  it('does not redeliver channels already completed by a previous run', async () => {
    const job = makeJob(NotificationJobType.NEW_SUBMISSION, submission.id) as any;
    await processor.process(job);
    await processor.process(job);

    expect(notificationsService.sendNewSubmissionEmail).toHaveBeenCalledTimes(1);
    expect(notificationsService.sendNewSubmissionPush).toHaveBeenCalledTimes(1);
    expect(metrics.increment).toHaveBeenCalledWith('notification_duplicate_total');
  });

  it('retries only the failed channel after a partial delivery', async () => {
    notificationsService.sendNewSubmissionPush
      .mockRejectedValueOnce(new Error('Push provider unavailable'))
      .mockResolvedValueOnce(true);
    const job = makeJob(NotificationJobType.NEW_SUBMISSION, submission.id) as any;

    await expect(processor.process(job)).rejects.toThrow('Push provider unavailable');
    await expect(processor.process(job)).resolves.toEqual(
      expect.objectContaining({ status: 'DELIVERED' })
    );

    expect(notificationsService.sendNewSubmissionEmail).toHaveBeenCalledTimes(1);
    expect(notificationsService.sendNewSubmissionPush).toHaveBeenCalledTimes(2);
    expect(deliveries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ channel: NotificationChannel.EMAIL, status: 'SENT' }),
        expect.objectContaining({ channel: NotificationChannel.PUSH, status: 'SENT', attempts: 2 }),
      ])
    );
  });

  it('records disabled channels as skipped', async () => {
    notificationsService.sendPublishedGradeEmail.mockResolvedValue(false);
    notificationsService.sendPublishedGradePush.mockResolvedValue(false);

    const result = await processor.process(
      makeJob(NotificationJobType.GRADE_PUBLISHED, evaluation.id) as any
    );

    expect(result.channels).toEqual({ EMAIL: 'SKIPPED', PUSH: 'SKIPPED' });
    expect(metrics.increment).toHaveBeenCalledWith('notification_channel_skipped_total');
  });

  it('creates only an internal notification for a definitive grading failure', async () => {
    const data = {
      type: NotificationJobType.GRADING_FAILED,
      aggregateId: submission.id,
      eventKey: 'grading-failed-grading-job-id',
    };

    await expect(processor.process({ data } as any)).resolves.toEqual({ status: 'DELIVERED' });

    expect(notificationsService.createGradingFailedInApp).toHaveBeenCalledWith(
      submission.assignment.user,
      submission.student,
      submission.assignment,
      submission,
      data.eventKey
    );
    expect(deliveries).toHaveLength(0);
    expect(notificationsService.sendNewSubmissionEmail).not.toHaveBeenCalled();
    expect(notificationsService.sendNewSubmissionPush).not.toHaveBeenCalled();
  });

  it('skips a stale grading-failure alert after the submission is retried', async () => {
    submissionRepository.findOne.mockResolvedValueOnce({
      ...submission,
      status: SubmissionStatus.PENDING,
    });
    const data = {
      type: NotificationJobType.GRADING_FAILED,
      aggregateId: submission.id,
      eventKey: 'grading-failed-stale-job-id',
    };

    await expect(processor.process({ data } as any)).resolves.toEqual({
      status: 'RECIPIENT_INELIGIBLE',
    });
    expect(notificationsService.createGradingFailedInApp).not.toHaveBeenCalled();
  });

  it('completes without sending when the source entity no longer exists', async () => {
    submissionRepository.findOne.mockResolvedValue(null);

    await expect(
      processor.process(makeJob(NotificationJobType.NEW_SUBMISSION, submission.id) as any)
    ).resolves.toEqual({ status: 'SOURCE_NOT_FOUND' });
    expect(notificationsService.sendNewSubmissionEmail).not.toHaveBeenCalled();
    expect(notificationsService.createNewSubmissionInApp).not.toHaveBeenCalled();
    expect(metrics.increment).toHaveBeenCalledWith('notification_source_missing_total');
  });

  it('scans upcoming assignments and queues only students without a submission', async () => {
    const now = Date.now();
    assignmentRepository.find.mockResolvedValue([
      {
        id: 'assignment-id',
        isActive: true,
        dueDate: new Date(now + 23 * 60 * 60 * 1000),
        course: {
          user: courseOwner,
          users: [
            { ...academicStudent, id: 'pending-id' },
            { ...academicStudent, id: 'submitted-id' },
          ],
        },
        submissions: [{ student: { id: 'submitted-id' } }],
      },
    ]);

    const result = await processor.process({
      data: {
        type: NotificationJobType.DEADLINE_REMINDER_SCAN,
        aggregateId: 'scheduled-scan',
        eventKey: 'assignment-deadline-reminder-scan',
      },
    } as any);

    expect(result).toEqual({ status: 'SCANNED', queuedCount: 1 });
    expect(notificationQueue.enqueueAssignmentReminder).toHaveBeenCalledWith(
      'assignment-id',
      'pending-id',
      expect.any(Date),
      AssignmentReminderKind.AUTO_24H,
      expect.any(Date)
    );
  });

  it('rechecks enrollment and submissions before delivering an assignment reminder', async () => {
    const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const student = {
      ...academicStudent,
      id: 'student-id',
      role: 'Estudiante',
      isActive: true,
      reminderNotificationsEnabled: true,
    };
    const reminderAssignment = {
      id: 'assignment-id',
      title: 'Ensayo',
      isActive: true,
      dueDate,
      course: { user: courseOwner, users: [student] },
      submissions: [],
    };
    assignmentRepository.findOne.mockResolvedValue(reminderAssignment);
    const data = {
      type: NotificationJobType.ASSIGNMENT_REMINDER,
      aggregateId: 'assignment-id',
      recipientId: student.id,
      reminderKind: AssignmentReminderKind.AUTO_24H,
      dueDateEpoch: dueDate.getTime(),
      eventKey: 'assignment-reminder-key',
    };

    await expect(processor.process({ data } as any)).resolves.toEqual(
      expect.objectContaining({ status: 'DELIVERED' })
    );
    expect(notificationsService.createAssignmentReminderInApp).toHaveBeenCalledWith(
      student,
      expect.objectContaining({ dueDate }),
      data.eventKey
    );

    reminderAssignment.submissions = [{ student: { id: student.id } }] as any;
    await expect(processor.process({ data } as any)).resolves.toEqual({
      status: 'RECIPIENT_INELIGIBLE',
    });
    expect(notificationsService.sendAssignmentReminderEmail).toHaveBeenCalledTimes(1);
  });

  it('queues and delivers reminders using the individual extended deadline', async () => {
    const now = Date.now();
    const student = {
      ...academicStudent,
      id: 'extended-student-id',
      role: UserRoles.Estudiante,
      isActive: true,
      reminderNotificationsEnabled: true,
    };
    const extendedDueDate = new Date(now + 20 * 60 * 60 * 1000);
    const reminderAssignment = {
      id: 'assignment-id',
      title: 'Proyecto',
      isActive: true,
      dueDate: new Date(now - 24 * 60 * 60 * 1000),
      course: { user: courseOwner, users: [student] },
      submissions: [],
      extensions: [{ student, extendedDueDate }],
    };
    assignmentRepository.find.mockResolvedValue([reminderAssignment]);

    await processor.process({
      data: {
        type: NotificationJobType.DEADLINE_REMINDER_SCAN,
        aggregateId: 'scheduled-scan',
        eventKey: 'assignment-deadline-reminder-scan',
      },
    } as any);

    expect(notificationQueue.enqueueAssignmentReminder).toHaveBeenCalledWith(
      reminderAssignment.id,
      student.id,
      extendedDueDate,
      AssignmentReminderKind.AUTO_24H,
      expect.any(Date)
    );

    assignmentRepository.findOne.mockResolvedValue(reminderAssignment);
    await expect(
      processor.process({
        data: {
          type: NotificationJobType.ASSIGNMENT_REMINDER,
          aggregateId: reminderAssignment.id,
          recipientId: student.id,
          reminderKind: AssignmentReminderKind.AUTO_24H,
          dueDateEpoch: extendedDueDate.getTime(),
          eventKey: 'extended-reminder-key',
        },
      } as any)
    ).resolves.toEqual(expect.objectContaining({ status: 'DELIVERED' }));
    expect(notificationsService.sendAssignmentReminderEmail).toHaveBeenLastCalledWith(
      student,
      expect.objectContaining({ dueDate: extendedDueDate }),
      'extended-reminder-key-email'
    );
  });

  it.each([
    ['inactive', { isActive: false }],
    ['pending approval', { approvalStatus: InstitutionApprovalStatus.PENDING }],
    ['inactive institution', { institution: { id: 'institution-id', isActive: false } }],
    ['missing institution', { institution: undefined }],
    ['another institution', { institutionId: 'another-institution' }],
  ])('skips queued grade channels for a student with %s access', async (_label, changes) => {
    evaluationRepository.findOne.mockResolvedValue({
      ...evaluation,
      submission: { ...submission, student: { ...submission.student, ...changes } },
    });

    await expect(
      processor.process(makeJob(NotificationJobType.GRADE_PUBLISHED, evaluation.id) as any)
    ).resolves.toEqual({ status: 'RECIPIENT_INELIGIBLE' });
    expect(notificationsService.createPublishedGradeInApp).not.toHaveBeenCalled();
    expect(notificationsService.sendPublishedGradeEmail).not.toHaveBeenCalled();
    expect(notificationsService.sendPublishedGradePush).not.toHaveBeenCalled();
    expect(deliveries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ channel: 'EMAIL', status: 'SKIPPED' }),
        expect.objectContaining({ channel: 'PUSH', status: 'SKIPPED' }),
      ])
    );
  });

  it('does not notify a draft or a student removed from the course', async () => {
    evaluationRepository.findOne.mockResolvedValueOnce({
      ...evaluation,
      status: EvaluationStatus.DRAFT,
    });
    evaluationRepository.findOne.mockResolvedValueOnce({
      ...evaluation,
      submission: {
        ...submission,
        assignment: { ...submission.assignment, course: { user: courseOwner, users: [] } },
      },
    });
    for (let index = 0; index < 2; index++) {
      await expect(
        processor.process(makeJob(NotificationJobType.GRADE_PUBLISHED, evaluation.id) as any)
      ).resolves.toEqual({ status: 'RECIPIENT_INELIGIBLE' });
    }
    expect(notificationsService.sendPublishedGradeEmail).not.toHaveBeenCalled();
  });

  it('does not resurrect a discarded grade notification after reactivation and queue replay', async () => {
    const job = makeJob(NotificationJobType.GRADE_PUBLISHED, evaluation.id);
    evaluationRepository.findOne.mockResolvedValueOnce({
      ...evaluation,
      submission: { ...submission, student: { ...submission.student, isActive: false } },
    });
    await processor.process(job as any);
    // The same durable event may be replayed after the worker crashes before acknowledging it.
    await processor.process(job as any);
    expect(notificationsService.createPublishedGradeInApp).not.toHaveBeenCalled();
    expect(notificationsService.sendPublishedGradeEmail).not.toHaveBeenCalled();
    expect(notificationsService.sendPublishedGradePush).not.toHaveBeenCalled();
  });

  it('does not resurrect a discarded reminder after reactivation and queue replay', async () => {
    const dueDate = new Date(Date.now() + 3600000);
    const student = { ...academicStudent, id: 'student-id', isActive: false };
    const assignment = {
      id: 'assignment-id',
      isActive: true,
      dueDate,
      course: { user: courseOwner, users: [student] },
      submissions: [],
    };
    assignmentRepository.findOne.mockResolvedValue(assignment);
    const job = {
      data: {
        type: NotificationJobType.ASSIGNMENT_REMINDER,
        aggregateId: assignment.id,
        eventKey: 'discarded-reminder',
        recipientId: student.id,
        reminderKind: AssignmentReminderKind.AUTO_24H,
        dueDateEpoch: dueDate.getTime(),
      },
    };
    await processor.process(job as any);
    student.isActive = true;
    await processor.process(job as any);
    expect(notificationsService.createAssignmentReminderInApp).not.toHaveBeenCalled();
    expect(notificationsService.sendAssignmentReminderEmail).not.toHaveBeenCalled();
    expect(notificationsService.sendAssignmentReminderPush).not.toHaveBeenCalled();
  });

  it('rechecks institutional approval after a reminder was queued', async () => {
    const dueDate = new Date(Date.now() + 3600000);
    const student = {
      ...academicStudent,
      id: 'student-id',
      approvalStatus: InstitutionApprovalStatus.REJECTED,
    };
    assignmentRepository.findOne.mockResolvedValue({
      id: 'assignment-id',
      isActive: true,
      dueDate,
      course: { user: courseOwner, users: [student] },
      submissions: [],
    });
    await expect(
      processor.process({
        data: {
          type: NotificationJobType.ASSIGNMENT_REMINDER,
          aggregateId: 'assignment-id',
          eventKey: 'revoked-reminder',
          recipientId: student.id,
          reminderKind: AssignmentReminderKind.AUTO_24H,
          dueDateEpoch: dueDate.getTime(),
        },
      } as any)
    ).resolves.toEqual({ status: 'RECIPIENT_INELIGIBLE' });
    expect(notificationsService.sendAssignmentReminderEmail).not.toHaveBeenCalled();
    expect(notificationsService.createAssignmentReminderInApp).not.toHaveBeenCalled();
  });

  it('does not enqueue reminders for pending students or disabled institutions', async () => {
    assignmentRepository.find.mockResolvedValue([
      {
        id: 'assignment-id',
        isActive: true,
        dueDate: new Date(Date.now() + 3600000),
        course: {
          user: courseOwner,
          users: [
            {
              ...academicStudent,
              id: 'pending',
              approvalStatus: InstitutionApprovalStatus.PENDING,
            },
            { ...academicStudent, id: 'disabled', institution: { isActive: false } },
          ],
        },
        submissions: [],
      },
    ]);
    await expect(
      processor.process({
        data: {
          type: NotificationJobType.DEADLINE_REMINDER_SCAN,
          aggregateId: 'scan',
          eventKey: 'scan',
        },
      } as any)
    ).resolves.toEqual({ status: 'SCANNED', queuedCount: 0 });
    expect(notificationQueue.enqueueAssignmentReminder).not.toHaveBeenCalled();
  });
});
