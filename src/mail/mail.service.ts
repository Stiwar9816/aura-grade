import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { Resend } from 'resend';
import { envs } from 'src/config';
import { User } from 'src/user/entities/user.entity';
import { RESEND_CLIENT } from './resend.constants';
import { Assignment } from 'src/assignment/entities/assignment.entity';
import { Evaluation } from 'src/evaluation/entities/evaluation.entity';

type MailTemplateVariables = Record<string, string | number>;

@Injectable()
export class MailService {
  constructor(@Inject(RESEND_CLIENT) private readonly resend: Resend) {}

  async sendUserConfirmation(user: User, plainPassword: string) {
    await this.sendEmail({
      to: user.email,
      subject: `¡Bienvenid@ a ${envs.app_name}! Aquí están tus credenciales`,
      templateId: envs.resend_confirmation_template_id,
      variables: {
        name: `${user.name} ${user.last_name}`,
        password: plainPassword,
        email: user.email,
        app_name: envs.app_name,
        url_app: envs.frontend_url,
      },
    });
  }
  async sendUpdatePassword(user: User, plainPassword: string) {
    await this.sendEmail({
      to: user.email,
      subject: `¡Hola ${user.name} ${user.last_name}! Aquí están tus credenciales actualizadas`,
      templateId: envs.resend_update_password_template_id,
      variables: {
        name: `${user.name} ${user.last_name}`,
        password: plainPassword,
        email: user.email,
        app_name: envs.app_name,
        url_app: envs.frontend_url,
      },
    });
  }

  async sendResetPassword(user: User, plainPassword: string) {
    await this.sendEmail({
      to: user.email,
      subject: '¡Solicitud de restablecimiento de contraseña 🔐!',
      templateId: envs.resend_reset_password_template_id,
      variables: {
        name: `${user.name} ${user.last_name}`,
        password: plainPassword,
        email: user.email,
        app_name: envs.app_name,
        url_app: envs.frontend_url,
        support_email: 'support@auragrade.com',
      },
    });
  }

  async sendNewSubmissionNotification(teacher: User, student: User, assignment: Assignment) {
    await this.sendEmail({
      to: teacher.email,
      subject: `Nueva entrega en ${assignment.title}`,
      templateId: envs.resend_new_submission_template_id,
      variables: {
        student_name: `${student.name} ${student.last_name}`,
        assignment_title: assignment.title,
        app_name: envs.app_name,
        url_app: envs.frontend_url,
      },
    });
  }

  async sendGradePublishedNotification(student: User, assignment: Assignment, score: Evaluation) {
    await this.sendEmail({
      to: student.email,
      subject: `Calificación publicada: ${assignment.title}`,
      templateId: envs.resend_grade_published_template_id,
      variables: {
        student_name: `${student.name} ${student.last_name}`,
        assignment_title: assignment.title,
        score: score.totalScore.toFixed(2),
        app_name: envs.app_name,
        url_app: envs.frontend_url,
      },
    });
  }

  private async sendEmail({
    to,
    subject,
    templateId,
    variables,
  }: {
    to: string;
    subject: string;
    templateId: string;
    variables: MailTemplateVariables;
  }) {
    const { error } = await this.resend.emails.send({
      from: envs.mail_from,
      to,
      subject,
      template: {
        id: templateId,
        variables,
      },
    });

    if (error) {
      throw new InternalServerErrorException(`No se pudo enviar el correo: ${error.message}`);
    }
  }
}
