import { Test, TestingModule } from '@nestjs/testing';
import { MailerService } from '@nestjs-modules/mailer';
import { MailService } from 'src/mail/mail.service';
import { User } from 'src/user/entities/user.entity';
import { DocumentType, UserRoles } from 'src/auth/enums';

describe('MailService', () => {
  let service: MailService;
  let mailerService: MailerService;

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
    checkFieldsBeforeInsert: jest.fn(),
    checkFieldsBeforeUpdate: jest.fn(),
  };

  const mockMailerService = {
    sendMail: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: MailerService,
          useValue: mockMailerService,
        },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
    mailerService = module.get<MailerService>(MailerService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendUserConfirmation', () => {
    it('should send user confirmation email with credentials', async () => {
      const plainPassword = 'Password123';
      mockMailerService.sendMail.mockResolvedValue(true);

      await service.sendUserConfirmation(mockUser, plainPassword);

      expect(mockMailerService.sendMail).toHaveBeenCalledWith({
        to: mockUser.email,
        subject: expect.stringContaining('Welcome'),
        template: './confirmation',
        context: {
          name: `${mockUser.name} ${mockUser.last_name}`,
          password: plainPassword,
          email: mockUser.email,
          app_name: expect.any(String),
          url_app: expect.any(String),
        },
      });
    });

    it('should include user full name in email context', async () => {
      const plainPassword = 'Password123';
      mockMailerService.sendMail.mockResolvedValue(true);

      await service.sendUserConfirmation(mockUser, plainPassword);

      const callArgs = mockMailerService.sendMail.mock.calls[0][0];
      expect(callArgs.context.name).toBe('John Doe');
    });
  });

  describe('sendUpdatePassword', () => {
    it('should send password update email', async () => {
      const plainPassword = 'NewPassword123';
      mockMailerService.sendMail.mockResolvedValue(true);

      await service.sendUpdatePassword(mockUser, plainPassword);

      expect(mockMailerService.sendMail).toHaveBeenCalledWith({
        to: mockUser.email,
        subject: expect.stringContaining('credentials updated'),
        template: './confirmation',
        context: {
          name: `${mockUser.name} ${mockUser.last_name}`,
          password: plainPassword,
          email: mockUser.email,
          app_name: expect.any(String),
          url_app: expect.any(String),
        },
      });
    });

    it('should include updated password in email context', async () => {
      const plainPassword = 'NewPassword123';
      mockMailerService.sendMail.mockResolvedValue(true);

      await service.sendUpdatePassword(mockUser, plainPassword);

      const callArgs = mockMailerService.sendMail.mock.calls[0][0];
      expect(callArgs.context.password).toBe(plainPassword);
    });
  });

  describe('sendResetPassword', () => {
    it('should send password reset email', async () => {
      const plainPassword = 'ResetPassword123';
      mockMailerService.sendMail.mockResolvedValue(true);

      await service.sendResetPassword(mockUser, plainPassword);

      expect(mockMailerService.sendMail).toHaveBeenCalledWith({
        to: mockUser.email,
        subject: 'Password Reset Request 🔐',
        template: './resetPassword',
        context: {
          name: `${mockUser.name} ${mockUser.last_name}`,
          password: plainPassword,
          email: mockUser.email,
          app_name: expect.any(String),
          url_app: expect.any(String),
          support_email: 'support@mail.com',
        },
      });
    });

    it('should use resetPassword template', async () => {
      const plainPassword = 'ResetPassword123';
      mockMailerService.sendMail.mockResolvedValue(true);

      await service.sendResetPassword(mockUser, plainPassword);

      const callArgs = mockMailerService.sendMail.mock.calls[0][0];
      expect(callArgs.template).toBe('./resetPassword');
    });

    it('should include support email in context', async () => {
      const plainPassword = 'ResetPassword123';
      mockMailerService.sendMail.mockResolvedValue(true);

      await service.sendResetPassword(mockUser, plainPassword);

      const callArgs = mockMailerService.sendMail.mock.calls[0][0];
      expect(callArgs.context.support_email).toBe('support@mail.com');
    });
  });
});
