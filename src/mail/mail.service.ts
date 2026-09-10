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

  async sendUserConfirmation(user: User) {
    await this.sendSecurityEmail(
      user,
      `Bienvenid@ a ${envs.app_name}`,
      [
        `Hola ${user.name} ${user.last_name},`,
        'Tu registro fue recibido y está pendiente de aprobación institucional.',
        `Cuando sea aprobado, inicia sesión en ${envs.frontend_url}.`,
        'Nunca te pediremos tu contraseña ni tus códigos de autenticación por correo.',
      ].join('\n\n')
    );
  }

  async sendUpdatePassword(user: User) {
    await this.sendSecurityEmail(
      user,
      'Tu contraseña fue actualizada',
      [
        `Hola ${user.name} ${user.last_name},`,
        'La contraseña de tu cuenta fue cambiada y tus sesiones anteriores quedaron invalidadas.',
        'Si no reconoces esta acción, solicita recuperación de acceso y escribe a soporte@auragrade.co.',
      ].join('\n\n')
    );
  }

  async sendResetPassword(user: User, token: string) {
    const url = `${envs.frontend_url.replace(/\/+$/, '')}/reset-password#token=${encodeURIComponent(token)}`;
    await this.sendSecurityEmail(
      user,
      'Restablece tu contraseña de Aura Grade',
      [
        `Hola ${user.name} ${user.last_name},`,
        'Usa este enlace una sola vez durante los próximos 30 minutos para elegir una contraseña nueva:',
        url,
        'Si no solicitaste este cambio, ignora el mensaje. Tu contraseña y tus sesiones siguen vigentes.',
        'Soporte: soporte@auragrade.co',
      ].join('\n\n')
    );
  }

  private async sendSecurityEmail(user: User, subject: string, text: string) {
    // Do not reuse legacy templates that requested a plaintext password.
    const { error } = await this.resend.emails.send({
      from: envs.mail_from,
      to: user.email,
      subject,
      text,
    });
    if (error) throw new InternalServerErrorException('No se pudo enviar el correo de seguridad.');
  }

  async sendUserInvitation(user: User, token: string, idempotencyKey?: string) {
    const invitationUrl = `${envs.frontend_url.replace(/\/+$/, '')}/create-password?token=${encodeURIComponent(token)}`;
    await this.sendEmail({
      to: user.email,
      subject: `Activa tu cuenta en ${envs.app_name}`,
      templateId: envs.resend_user_invitation_template_id,
      idempotencyKey,
      variables: {
        name: `${user.name} ${user.last_name}`,
        app_name: envs.app_name,
        invitationUrl,
      },
    });
  }

  async sendNewSubmissionNotification(
    teacher: User,
    student: User,
    assignment: Assignment,
    idempotencyKey?: string
  ) {
    await this.sendEmail({
      to: teacher.email,
      subject: `Nueva entrega en ${assignment.title}`,
      templateId: envs.resend_new_submission_template_id,
      idempotencyKey,
      variables: {
        student_name: `${student.name} ${student.last_name}`,
        assignment_title: assignment.title,
        app_name: envs.app_name,
        url_app: envs.frontend_url,
      },
    });
  }

  async sendGradePublishedNotification(
    student: User,
    assignment: Assignment,
    score: Evaluation,
    idempotencyKey?: string
  ) {
    await this.sendEmail({
      to: student.email,
      subject: `Calificación publicada: ${assignment.title}`,
      templateId: envs.resend_grade_published_template_id,
      idempotencyKey,
      variables: {
        student_name: `${student.name} ${student.last_name}`,
        assignment_title: assignment.title,
        score: score.totalScore,
        app_name: envs.app_name,
        url_app: envs.frontend_url,
      },
    });
  }

  async sendAssignmentReminderNotification(
    student: User,
    assignment: Assignment,
    idempotencyKey?: string
  ) {
    const dueDate = new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: 'America/Bogota',
    }).format(assignment.dueDate);
    const assignmentUrl = `${envs.frontend_url.replace(/\/+$/, '')}/upload?assignment=${assignment.id}`;
    if (envs.resend_task_reminder_template_id) {
      await this.sendEmail({
        to: student.email,
        subject: `Recordatorio de entrega: ${assignment.title}`,
        templateId: envs.resend_task_reminder_template_id,
        idempotencyKey,
        variables: {
          student_name: `${student.name} ${student.last_name}`,
          assignment_title: assignment.title,
          due_date: dueDate,
          url_assignment: assignmentUrl,
        },
      });
      return;
    }

    const payload = {
      from: envs.mail_from,
      to: student.email,
      subject: `Recordatorio de entrega: ${assignment.title}`,
      text: [
        `Hola ${student.name} ${student.last_name},`,
        '',
        `La tarea "${assignment.title}" vence ${dueDate} y aún no registras una entrega.`,
        `Puedes entregarla en ${assignmentUrl}`,
      ].join('\n'),
    };
    const { error } = idempotencyKey
      ? await this.resend.emails.send(payload, { idempotencyKey })
      : await this.resend.emails.send(payload);
    if (error)
      throw new InternalServerErrorException(`No se pudo enviar el correo: ${error.message}`);
  }

  private async sendEmail({
    to,
    subject,
    templateId,
    variables,
    idempotencyKey,
  }: {
    to: string;
    subject: string;
    templateId: string;
    variables: MailTemplateVariables;
    idempotencyKey?: string;
  }) {
    const payload = {
      from: envs.mail_from,
      to,
      subject,
      template: {
        id: templateId,
        variables,
      },
    };
    const { error } = idempotencyKey
      ? await this.resend.emails.send(payload, { idempotencyKey })
      : await this.resend.emails.send(payload);

    if (error) {
      throw new InternalServerErrorException(`No se pudo enviar el correo: ${error.message}`);
    }
  }
}
