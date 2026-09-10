import { Test, TestingModule } from '@nestjs/testing';
import { MailService } from 'src/mail/mail.service';
import { User } from 'src/user/entities/user.entity';
import { DocumentType, UserRoles } from 'src/auth/enums';
import { RESEND_CLIENT } from 'src/mail/resend.constants';
import { InstitutionApprovalStatus } from 'src/institution';
import { Assignment } from 'src/assignment/entities/assignment.entity';
import { Evaluation } from 'src/evaluation/entities/evaluation.entity';
import { envs } from 'src/config';

describe('MailService', () => {
  let service: MailService;

  const mockUser: User = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'John',
    last_name: 'Doe',
    document_type: DocumentType.CITIZENSHIP_CARD,
    document_num: 123456789,
    phone: 3001234567,
    email: 'john.doe@example.com',
    password: 'hashedPassword123',
    isActive: true,
    role: UserRoles.Estudiante,
    approvalStatus: InstitutionApprovalStatus.APPROVED,
    institutionId: 'f1d24f6e-b766-4e3f-a1c9-4d4c0a58ad31',
    institution: {
      id: 'f1d24f6e-b766-4e3f-a1c9-4d4c0a58ad31',
      name: 'Universidad Aura',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    authVersion: 1,
    isPlatformAdmin: false,
    checkFieldsBeforeInsert: jest.fn(),
    checkFieldsBeforeUpdate: jest.fn(),
  };

  const mockResend = {
    emails: {
      send: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: RESEND_CLIENT,
          useValue: mockResend,
        },
      ],
    }).compile();

    service = module.get<MailService>(MailService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('security emails', () => {
    beforeEach(() =>
      mockResend.emails.send.mockResolvedValue({ data: { id: 'mail' }, error: null })
    );
    it('sends registration status without credentials or legacy templates', async () => {
      await service.sendUserConfirmation(mockUser);
      const payload = mockResend.emails.send.mock.calls[0][0];
      expect(payload.text).toContain('pendiente de aprobación');
      expect(payload).not.toHaveProperty('template');
      expect(JSON.stringify(payload)).not.toContain(mockUser.password);
    });
    it('sends a change notice without a password', async () => {
      await service.sendUpdatePassword(mockUser);
      expect(mockResend.emails.send.mock.calls[0][0].text).toContain('sesiones');
      expect(JSON.stringify(mockResend.emails.send.mock.calls[0][0])).not.toContain(
        mockUser.password
      );
    });
    it('places the reset token in the URL fragment and specifies expiration', async () => {
      await service.sendResetPassword(mockUser, 'opaque-token');
      const payload = mockResend.emails.send.mock.calls[0][0];
      expect(payload.text).toContain('/reset-password#token=opaque-token');
      expect(payload.text).toContain('30 minutos');
      expect(payload.text).toContain('soporte@auragrade.co');
      expect(payload).not.toHaveProperty('template');
    });
    it('reports provider failures without exposing provider details', async () => {
      mockResend.emails.send.mockResolvedValue({ error: { message: 'secret provider detail' } });
      await expect(service.sendUpdatePassword(mockUser)).rejects.toThrow('correo de seguridad');
    });
  });

  describe('notification emails', () => {
    it('sends a one-time password setup link for an imported user', async () => {
      mockResend.emails.send.mockResolvedValue({ data: { id: 'email-id' }, error: null });

      await service.sendUserInvitation(mockUser, 'invitation-token', 'user-import-id');

      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: mockUser.email,
          subject: expect.stringContaining('Activa tu cuenta'),
          template: expect.objectContaining({
            variables: expect.objectContaining({
              invitationUrl: expect.stringContaining('/create-password?token=invitation-token'),
            }),
          }),
        }),
        { idempotencyKey: 'user-import-id' }
      );
    });

    it('sends a templated new submission notification', async () => {
      mockResend.emails.send.mockResolvedValue({ data: { id: 'email-id' }, error: null });
      envs.resend_new_submission_template_id = 'new-submission-test';

      await service.sendNewSubmissionNotification(
        mockUser,
        { ...mockUser, name: 'Ana', last_name: 'Estudiante' } as User,
        { title: 'Ensayo final' } as Assignment
      );

      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: mockUser.email,
          subject: expect.stringContaining('Nueva entrega'),
          template: expect.objectContaining({
            variables: expect.objectContaining({
              student_name: 'Ana Estudiante',
              assignment_title: 'Ensayo final',
            }),
          }),
        })
      );
    });

    it('uses a stable Resend idempotency key for retry-safe notification email', async () => {
      mockResend.emails.send.mockResolvedValue({ data: { id: 'email-id' }, error: null });

      await service.sendNewSubmissionNotification(
        mockUser,
        { ...mockUser, name: 'Ana', last_name: 'Estudiante' } as User,
        { title: 'Ensayo final' } as Assignment,
        'new-submission-submission-id-email'
      );

      expect(mockResend.emails.send).toHaveBeenCalledWith(expect.any(Object), {
        idempotencyKey: 'new-submission-submission-id-email',
      });
    });

    it('uses the assignment and evaluation entities in the published grade notification', async () => {
      mockResend.emails.send.mockResolvedValue({ data: { id: 'email-id' }, error: null });
      const assignment = { title: 'Ensayo final' } as Assignment;
      const evaluation = { totalScore: 4.5 } as Evaluation;

      await service.sendGradePublishedNotification(mockUser, assignment, evaluation);

      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: mockUser.email,
          subject: 'Calificación publicada: Ensayo final',
          template: expect.objectContaining({
            variables: expect.objectContaining({
              assignment_title: 'Ensayo final',
              score: 4.5,
            }),
          }),
        })
      );
    });

    it('sends a plain-text assignment reminder with a direct upload link', async () => {
      mockResend.emails.send.mockResolvedValue({ data: { id: 'email-id' }, error: null });
      const assignment = {
        id: 'assignment-id',
        title: 'Ensayo final',
        dueDate: new Date('2026-08-17T15:00:00.000Z'),
      } as Assignment;

      await service.sendAssignmentReminderNotification(
        mockUser,
        assignment,
        'assignment-reminder-email'
      );

      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: mockUser.email,
          subject: 'Recordatorio de entrega: Ensayo final',
          template: expect.objectContaining({
            variables: expect.objectContaining({
              url_assignment: expect.stringContaining('/upload?assignment=assignment-id'),
            }),
          }),
        }),
        { idempotencyKey: 'assignment-reminder-email' }
      );
    });

    it('uses the optional Resend template when it is configured', async () => {
      mockResend.emails.send.mockResolvedValue({ data: { id: 'email-id' }, error: null });
      envs.resend_task_reminder_template_id = 'assignment-reminder-test';
      const assignment = {
        id: 'assignment-id',
        title: 'Ensayo final',
        dueDate: new Date('2026-08-17T15:00:00.000Z'),
      } as Assignment;

      try {
        await service.sendAssignmentReminderNotification(mockUser, assignment);

        expect(mockResend.emails.send).toHaveBeenCalledWith(
          expect.objectContaining({
            template: expect.objectContaining({
              id: 'assignment-reminder-test',
              variables: expect.objectContaining({
                assignment_title: 'Ensayo final',
                url_assignment: expect.stringContaining('/upload?assignment=assignment-id'),
              }),
            }),
          })
        );
      } finally {
        envs.resend_task_reminder_template_id = undefined;
      }
    });
  });
});
