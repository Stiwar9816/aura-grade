import { UserRoles } from 'src/auth/enums';
import { Assignment } from 'src/assignment/entities/assignment.entity';
import { Evaluation } from 'src/evaluation/entities/evaluation.entity';
import { InstitutionApprovalStatus } from 'src/institution';
import { NotificationsService } from 'src/notifications/notifications.service';
import { User } from 'src/user/entities/user.entity';

describe('NotificationsService', () => {
  const repository = { update: jest.fn() };
  const mailService = {
    sendNewSubmissionNotification: jest.fn(),
    sendGradePublishedNotification: jest.fn(),
  };
  const webPushService = {
    getPublicKey: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    sendToUser: jest.fn(),
  };
  const service = new NotificationsService(
    repository as any,
    mailService as any,
    webPushService as any
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
  } as User;
  const assignment = { id: 'assignment-id', title: 'Ensayo final' } as Assignment;
  const evaluation = {
    id: 'evaluation-id',
    totalScore: 4.5,
    submission: { id: 'submission-id' },
  } as Evaluation;

  beforeEach(() => {
    jest.clearAllMocks();
    user.emailNotificationsEnabled = true;
    user.browserNotificationsEnabled = false;
    user.submissionNotificationsEnabled = true;
    user.gradeNotificationsEnabled = true;
    webPushService.sendToUser.mockResolvedValue(1);
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
    await expect(service.sendPublishedGradePush(user, assignment, evaluation)).resolves.toBe(
      false
    );

    expect(webPushService.sendToUser).not.toHaveBeenCalled();
  });

  it('sends a published grade Web Push to the evaluation submission', async () => {
    const student = { ...user, browserNotificationsEnabled: true } as User;

    await expect(
      service.sendPublishedGradePush(student, assignment, evaluation)
    ).resolves.toBe(true);

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
});
