import { NotificationDeliveryEntity } from 'src/notifications/entities/notification-delivery.entity';
import {
  AssignmentReminderKind,
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationJobType,
  notificationEventKey,
} from 'src/notifications/notification-queue.constants';
import { NotificationProcessor } from 'src/notifications/notification.processor';

describe('NotificationProcessor', () => {
  const submission = {
    id: 'submission-id',
    student: { id: 'student-id', name: 'Ana', last_name: 'Pérez' },
    assignment: {
      id: 'assignment-id',
      title: 'Ensayo',
      user: { id: 'teacher-id' },
    },
  } as any;
  const evaluation = {
    id: 'evaluation-id',
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
          users: [
            { id: 'pending-id', role: 'Estudiante', isActive: true },
            { id: 'submitted-id', role: 'Estudiante', isActive: true },
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
      course: { users: [student] },
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
      reminderAssignment,
      data.eventKey
    );

    reminderAssignment.submissions = [{ student: { id: student.id } }] as any;
    await expect(processor.process({ data } as any)).resolves.toEqual({
      status: 'RECIPIENT_INELIGIBLE',
    });
    expect(notificationsService.sendAssignmentReminderEmail).toHaveBeenCalledTimes(1);
  });
});
