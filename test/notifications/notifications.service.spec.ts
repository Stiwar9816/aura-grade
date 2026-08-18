import { UserRoles } from 'src/auth/enums';
import { Assignment } from 'src/assignment/entities/assignment.entity';
import { Evaluation } from 'src/evaluation/entities/evaluation.entity';
import { InstitutionApprovalStatus } from 'src/institution';
import { NotificationsService } from 'src/notifications/notifications.service';
import { NotificationResourceType } from 'src/notifications/entities/in-app-notification.entity';
import { User } from 'src/user/entities/user.entity';
import { AssignmentReminderKind } from 'src/notifications/notification-queue.constants';
import { Submission } from 'src/submission/entities/submission.entity';

describe('NotificationsService', () => {
  const repository = { update: jest.fn() };
  const inAppRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };
  const assignmentRepository = { findOne: jest.fn() };
  const mailService = {
    sendNewSubmissionNotification: jest.fn(),
    sendGradePublishedNotification: jest.fn(),
    sendAssignmentReminderNotification: jest.fn(),
  };
  const webPushService = {
    getPublicKey: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    sendToUser: jest.fn(),
  };
  const notificationQueue = {
    getManualAssignmentReminderCooldownUntil: jest.fn(),
    enqueueAssignmentReminder: jest.fn(),
  };
  const service = new NotificationsService(
    repository as any,
    inAppRepository as any,
    assignmentRepository as any,
    mailService as any,
    webPushService as any,
    notificationQueue as any
  );
  const user = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Andrea',
    last_name: 'Rojas',
    email: 'andrea@example.com',
    role: UserRoles.Administrador,
    approvalStatus: InstitutionApprovalStatus.APPROVED,
    institutionId: '223e4567-e89b-12d3-a456-426614174000',
    emailNotificationsEnabled: true,
    browserNotificationsEnabled: false,
    submissionNotificationsEnabled: true,
    gradeNotificationsEnabled: true,
    reminderNotificationsEnabled: true,
  } as User;
  const assignment = { id: 'assignment-id', title: 'Ensayo final' } as Assignment;
  const evaluation = {
    id: 'evaluation-id',
    totalScore: 4.5,
    submission: { id: 'submission-id' },
  } as Evaluation;
  const failedSubmission = {
    id: 'submission-id',
    status: 'FAILED',
    gradingAttemptCount: 3,
    gradingFailureReason: 'El servicio de IA no pudo completar la evaluación.',
  } as Submission;

  beforeEach(() => {
    jest.clearAllMocks();
    user.emailNotificationsEnabled = true;
    user.browserNotificationsEnabled = false;
    user.submissionNotificationsEnabled = true;
    user.gradeNotificationsEnabled = true;
    user.reminderNotificationsEnabled = true;
    webPushService.sendToUser.mockResolvedValue(1);
    inAppRepository.findOne.mockResolvedValue(null);
    inAppRepository.create.mockImplementation((value) => ({ ...value }));
    inAppRepository.save.mockImplementation((value) => Promise.resolve(value));
    notificationQueue.getManualAssignmentReminderCooldownUntil.mockResolvedValue(undefined);
    notificationQueue.enqueueAssignmentReminder.mockResolvedValue({
      eventKey: 'reminder-key',
      queued: true,
    });
  });

  it('returns safe defaults for users created before the preference migration', () => {
    expect(
      service.getPreferences({
        ...user,
        emailNotificationsEnabled: undefined,
      } as User)
    ).toEqual({
      emailEnabled: true,
      browserEnabled: false,
      newSubmissionsEnabled: true,
      gradesEnabled: true,
      remindersEnabled: true,
    });
  });

  it('persists only the supplied preference values', async () => {
    repository.update.mockResolvedValue({ affected: 1 });

    const result = await service.updatePreferences(user, {
      emailEnabled: false,
      browserEnabled: true,
    });

    expect(repository.update).toHaveBeenCalledWith(user.id, {
      emailNotificationsEnabled: false,
      browserNotificationsEnabled: true,
    });
    expect(result.emailEnabled).toBe(false);
    expect(result.browserEnabled).toBe(true);
  });

  it('returns a paginated notification center scoped to the current user', async () => {
    const createdAt = new Date('2026-08-15T12:00:00.000Z');
    inAppRepository.find.mockResolvedValue([
      {
        id: 'notification-id',
        recipientId: user.id,
        type: 'GRADE_PUBLISHED',
        title: 'Calificación publicada',
        body: 'Ya puedes consultar la calificación.',
        url: '/evaluation?submission=submission-id',
        resourceType: NotificationResourceType.EVALUATION,
        resourceId: 'evaluation-id',
        createdAt,
      },
    ]);
    inAppRepository.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1);

    await expect(service.listNotifications(user, { page: 1, limit: 20 })).resolves.toEqual({
      items: [expect.objectContaining({ id: 'notification-id', createdAt, readAt: undefined })],
      page: 1,
      limit: 20,
      total: 1,
      unreadCount: 1,
      hasMore: false,
    });
    expect(inAppRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { recipientId: user.id }, skip: 0, take: 20 })
    );
  });

  it('normalizes validated query values before returning pagination metadata', async () => {
    inAppRepository.find.mockResolvedValue([]);
    inAppRepository.count.mockResolvedValue(0);

    const result = await service.listNotifications(user, {
      page: '2' as unknown as number,
      limit: '10' as unknown as number,
    });

    expect(result).toEqual(expect.objectContaining({ page: 2, limit: 10 }));
    expect(inAppRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 })
    );
  });

  it('does not let a user mark a foreign notification as read', async () => {
    inAppRepository.findOne.mockResolvedValue(null);

    await expect(service.markNotificationRead(user, 'foreign-id')).rejects.toThrow(
      'No se encontró la notificación.'
    );
  });

  it('creates one in-app notification for a new submission', async () => {
    const teacher = { ...user, role: UserRoles.Docente } as User;

    await expect(
      service.createNewSubmissionInApp(teacher, user, assignment, 'submission-id')
    ).resolves.toBe(true);

    expect(inAppRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: teacher.id,
        eventKey: 'new-submission-submission-id',
        resourceType: NotificationResourceType.SUBMISSION,
        resourceId: 'submission-id',
      })
    );
  });

  it('does not duplicate an existing in-app notification', async () => {
    inAppRepository.findOne.mockResolvedValue({ id: 'existing-id' });

    await expect(service.createPublishedGradeInApp(user, assignment, evaluation)).resolves.toBe(
      false
    );
    expect(inAppRepository.save).not.toHaveBeenCalled();
  });

  it('creates a safe direct internal alert for a definitive grading failure', async () => {
    const teacher = { ...user, id: 'teacher-id', role: UserRoles.Docente } as User;
    const student = { ...user, id: 'student-id', name: 'Ana', last_name: 'Pérez' } as User;

    await expect(
      service.createGradingFailedInApp(
        teacher,
        student,
        assignment,
        failedSubmission,
        'grading-failed-grading-job-id'
      )
    ).resolves.toBe(true);

    expect(inAppRepository.create).toHaveBeenCalledWith({
      recipientId: teacher.id,
      eventKey: 'grading-failed-grading-job-id',
      type: 'GRADING_FAILED',
      title: 'Calificación automática fallida',
      body: 'No se pudo calificar “Ensayo final” de Ana Pérez. El servicio de IA no pudo completar la evaluación. Intentos registrados: 3.',
      url: '/teacher/assignments/assignment-id?submission=submission-id',
      resourceType: NotificationResourceType.SUBMISSION,
      resourceId: 'submission-id',
    });
  });

  it('does not email new submissions when that event is disabled', async () => {
    await service.sendNewSubmissionEmail(
      { ...user, submissionNotificationsEnabled: false } as User,
      user,
      assignment
    );

    expect(mailService.sendNewSubmissionNotification).not.toHaveBeenCalled();
  });

  it('emails published grades when both email and grade notifications are enabled', async () => {
    mailService.sendGradePublishedNotification.mockResolvedValue(undefined);

    await service.sendPublishedGradeEmail(user, assignment, evaluation);

    expect(mailService.sendGradePublishedNotification).toHaveBeenCalledWith(
      user,
      assignment,
      evaluation,
      undefined
    );
  });

  it('sends email and Web Push channels for a new submission when both are enabled', async () => {
    const teacher = { ...user, browserNotificationsEnabled: true } as User;

    await service.sendNewSubmissionEmail(teacher, user, assignment, 'submission-email-key');
    await service.sendNewSubmissionPush(teacher, user, assignment, 'submission-id');

    expect(mailService.sendNewSubmissionNotification).toHaveBeenCalledWith(
      teacher,
      user,
      assignment,
      'submission-email-key'
    );
    expect(webPushService.sendToUser).toHaveBeenCalledWith(
      teacher.id,
      expect.objectContaining({
        title: 'Nueva entrega',
        url: `/teacher/assignments/${assignment.id}`,
        tag: 'submission:submission-id',
      })
    );
  });

  it('does not send Web Push when browser notifications are disabled', async () => {
    await expect(service.sendPublishedGradePush(user, assignment, evaluation)).resolves.toBe(false);

    expect(webPushService.sendToUser).not.toHaveBeenCalled();
  });

  it('sends a published grade Web Push to the evaluation submission', async () => {
    const student = { ...user, browserNotificationsEnabled: true } as User;

    await expect(service.sendPublishedGradePush(student, assignment, evaluation)).resolves.toBe(
      true
    );

    expect(webPushService.sendToUser).toHaveBeenCalledWith(
      student.id,
      expect.objectContaining({
        title: 'Calificación publicada',
        url: '/evaluation?submission=submission-id',
        tag: 'grade:evaluation-id',
      })
    );
  });

  it('delegates device subscription lifecycle to WebPushService', async () => {
    webPushService.getPublicKey.mockReturnValue('public-key');
    webPushService.subscribe.mockResolvedValue(undefined);
    webPushService.unsubscribe.mockResolvedValue(true);
    const subscription = {
      endpoint: 'https://push.example/subscription',
      keys: { p256dh: 'a'.repeat(32), auth: 'b'.repeat(16) },
    };

    expect(service.getPushPublicKey()).toBe('public-key');
    await service.subscribePush(user, subscription, 'Test Browser');
    await expect(service.unsubscribePush(user, subscription.endpoint)).resolves.toBe(true);
    expect(webPushService.subscribe).toHaveBeenCalledWith(user, subscription, 'Test Browser');
    expect(webPushService.unsubscribe).toHaveBeenCalledWith(user, subscription.endpoint);
  });

  it('previews only active enrolled students without a submission', async () => {
    const teacher = { ...user, role: UserRoles.Docente, id: 'teacher-id' } as User;
    const dueDate = new Date('2026-08-17T12:00:00.000Z');
    assignmentRepository.findOne.mockResolvedValue({
      id: 'assignment-id',
      isActive: true,
      dueDate,
      user: teacher,
      course: {
        users: [
          { ...user, id: 'pending-id', role: UserRoles.Estudiante },
          { ...user, id: 'submitted-id', role: UserRoles.Estudiante },
          {
            ...user,
            id: 'opted-out-id',
            role: UserRoles.Estudiante,
            reminderNotificationsEnabled: false,
          },
        ],
      },
      submissions: [{ student: { id: 'submitted-id' } }],
    });

    await expect(
      service.getAssignmentReminderPreview(
        teacher,
        'assignment-id',
        new Date('2026-08-15T12:00:00.000Z')
      )
    ).resolves.toEqual(
      expect.objectContaining({ pendingCount: 2, eligibleCount: 1, canSendCount: 1 })
    );
  });

  it('enqueues a manual reminder only once during the cooldown window', async () => {
    const teacher = { ...user, role: UserRoles.Docente, id: 'teacher-id' } as User;
    const student = { ...user, id: 'pending-id', role: UserRoles.Estudiante } as User;
    const dueDate = new Date('2026-08-17T12:00:00.000Z');
    assignmentRepository.findOne.mockResolvedValue({
      id: 'assignment-id',
      isActive: true,
      dueDate,
      user: teacher,
      course: { users: [student] },
      submissions: [],
    });
    notificationQueue.enqueueAssignmentReminder.mockResolvedValue({
      eventKey: 'reminder-key',
      queued: false,
      cooldownUntil: new Date('2026-08-15T18:00:00.000Z'),
    });

    await expect(
      service.sendManualAssignmentReminders(
        teacher,
        'assignment-id',
        new Date('2026-08-15T12:00:00.000Z')
      )
    ).resolves.toEqual(
      expect.objectContaining({ queuedCount: 0, cooldownCount: 1, canSendCount: 0 })
    );
  });

  it('uses an individual extension when queueing a manual reminder after the general deadline', async () => {
    const teacher = { ...user, role: UserRoles.Docente, id: 'teacher-id' } as User;
    const student = { ...user, id: 'pending-id', role: UserRoles.Estudiante } as User;
    const extendedDueDate = new Date('2026-08-17T12:00:00.000Z');
    assignmentRepository.findOne.mockResolvedValue({
      id: 'assignment-id',
      isActive: true,
      dueDate: new Date('2026-08-14T12:00:00.000Z'),
      user: teacher,
      course: { users: [student] },
      submissions: [],
      extensions: [{ student, extendedDueDate }],
    });
    notificationQueue.enqueueAssignmentReminder.mockResolvedValue({
      eventKey: 'extended-reminder-key',
      queued: true,
    });

    await expect(
      service.sendManualAssignmentReminders(
        teacher,
        'assignment-id',
        new Date('2026-08-15T12:00:00.000Z')
      )
    ).resolves.toEqual(expect.objectContaining({ queuedCount: 1, eligibleCount: 1 }));
    expect(notificationQueue.enqueueAssignmentReminder).toHaveBeenCalledWith(
      'assignment-id',
      student.id,
      extendedDueDate,
      AssignmentReminderKind.MANUAL,
      new Date('2026-08-15T12:00:00.000Z')
    );
  });

  it('creates and sends enabled assignment reminder channels', async () => {
    const student = {
      ...user,
      role: UserRoles.Estudiante,
      browserNotificationsEnabled: true,
    } as User;
    const reminderAssignment = {
      ...assignment,
      dueDate: new Date('2026-08-17T12:00:00.000Z'),
    } as Assignment;

    await service.createAssignmentReminderInApp(student, reminderAssignment, 'reminder-key');
    await service.sendAssignmentReminderEmail(student, reminderAssignment, 'reminder-key-email');
    await service.sendAssignmentReminderPush(student, reminderAssignment, 'reminder-key');

    expect(inAppRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ASSIGNMENT_REMINDER',
        resourceType: NotificationResourceType.ASSIGNMENT,
      })
    );
    expect(mailService.sendAssignmentReminderNotification).toHaveBeenCalledWith(
      student,
      reminderAssignment,
      'reminder-key-email'
    );
    expect(webPushService.sendToUser).toHaveBeenCalledWith(
      student.id,
      expect.objectContaining({ url: '/upload?assignment=assignment-id' })
    );
  });
});
