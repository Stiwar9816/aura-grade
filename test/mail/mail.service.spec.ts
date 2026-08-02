import { Test, TestingModule } from '@nestjs/testing';
import { MailService } from 'src/mail/mail.service';
import { User } from 'src/user/entities/user.entity';
import { DocumentType, UserRoles } from 'src/auth/enums';
import { RESEND_CLIENT } from 'src/mail/resend.constants';
import { InstitutionApprovalStatus } from 'src/institution';
import { Assignment } from 'src/assignment/entities/assignment.entity';
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

  describe('sendUserConfirmation', () => {
    it('should send user confirmation email with credentials', async () => {
      const plainPassword = 'Password123';
      mockResend.emails.send.mockResolvedValue({ data: { id: 'email-id' }, error: null });

      await service.sendUserConfirmation(mockUser, plainPassword);

      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          from: expect.any(String),
          to: mockUser.email,
          subject: expect.stringContaining('Bienvenid@'),
          template: expect.objectContaining({
            id: expect.any(String),
            variables: expect.objectContaining({
              name: `${mockUser.name} ${mockUser.last_name}`,
              password: plainPassword,
              email: mockUser.email,
              app_name: expect.any(String),
              url_app: expect.any(String),
            }),
          }),
        })
      );
    });

    it('should include user full name in email context', async () => {
      const plainPassword = 'Password123';
      mockResend.emails.send.mockResolvedValue({ data: { id: 'email-id' }, error: null });

      await service.sendUserConfirmation(mockUser, plainPassword);

      const callArgs = mockResend.emails.send.mock.calls[0][0];
      expect(callArgs.template.variables.name).toBe('John Doe');
    });
  });

  describe('notification emails', () => {
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

    it('sends a plain-text published grade notification', async () => {
      mockResend.emails.send.mockResolvedValue({ data: { id: 'email-id' }, error: null });

      await service.sendGradePublishedNotification(mockUser, 'Ensayo final', 4.5);

      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: mockUser.email,
          subject: expect.stringContaining('Calificación publicada'),
          text: expect.stringContaining('4.5'),
        })
      );
    });
  });

  describe('sendUpdatePassword', () => {
    it('should send password update email', async () => {
      const plainPassword = 'NewPassword123';
      mockResend.emails.send.mockResolvedValue({ data: { id: 'email-id' }, error: null });

      await service.sendUpdatePassword(mockUser, plainPassword);

      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          from: expect.any(String),
          to: mockUser.email,
          subject: expect.stringContaining('credenciales actualizadas'),
          template: expect.objectContaining({
            id: expect.any(String),
            variables: expect.objectContaining({
              name: `${mockUser.name} ${mockUser.last_name}`,
              password: plainPassword,
              email: mockUser.email,
              app_name: expect.any(String),
              url_app: expect.any(String),
            }),
          }),
        })
      );
    });

    it('should include updated password in email context', async () => {
      const plainPassword = 'NewPassword123';
      mockResend.emails.send.mockResolvedValue({ data: { id: 'email-id' }, error: null });

      await service.sendUpdatePassword(mockUser, plainPassword);

      const callArgs = mockResend.emails.send.mock.calls[0][0];
      expect(callArgs.template.variables.password).toBe(plainPassword);
    });
  });

  describe('sendResetPassword', () => {
    it('should send password reset email', async () => {
      const plainPassword = 'ResetPassword123';
      mockResend.emails.send.mockResolvedValue({ data: { id: 'email-id' }, error: null });

      await service.sendResetPassword(mockUser, plainPassword);

      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          from: expect.any(String),
          to: mockUser.email,
          subject: '¡Solicitud de restablecimiento de contraseña 🔐!',
          template: expect.objectContaining({
            id: expect.any(String),
            variables: expect.objectContaining({
              name: `${mockUser.name} ${mockUser.last_name}`,
              password: plainPassword,
              email: mockUser.email,
              app_name: expect.any(String),
              url_app: expect.any(String),
              support_email: 'support@auragrade.com',
            }),
          }),
        })
      );
    });

    it('should use reset password template id', async () => {
      const plainPassword = 'ResetPassword123';
      mockResend.emails.send.mockResolvedValue({ data: { id: 'email-id' }, error: null });

      await service.sendResetPassword(mockUser, plainPassword);

      const callArgs = mockResend.emails.send.mock.calls[0][0];
      expect(callArgs.template.id).toEqual(expect.any(String));
    });

    it('should include support email in context', async () => {
      const plainPassword = 'ResetPassword123';
      mockResend.emails.send.mockResolvedValue({ data: { id: 'email-id' }, error: null });

      await service.sendResetPassword(mockUser, plainPassword);

      const callArgs = mockResend.emails.send.mock.calls[0][0];
      expect(callArgs.template.variables.support_email).toBe('support@auragrade.com');
    });
  });
});
