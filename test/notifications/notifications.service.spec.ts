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
  const service = new NotificationsService(repository as any, mailService as any);
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
  const evaluation = { id: 'evaluation-id', totalScore: 4.5 } as Evaluation;

  beforeEach(() => {
    jest.clearAllMocks();
    user.emailNotificationsEnabled = true;
    user.browserNotificationsEnabled = false;
    user.submissionNotificationsEnabled = true;
    user.gradeNotificationsEnabled = true;
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
      evaluation
    );
  });
});
