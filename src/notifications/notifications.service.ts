import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Assignment } from 'src/assignment/entities/assignment.entity';
import { Evaluation } from 'src/evaluation/entities/evaluation.entity';
import { MailService } from 'src/mail/mail.service';
import { User } from 'src/user/entities/user.entity';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { SavePushSubscriptionDto } from './dto/push-subscription.dto';
import { WebPushService } from './web-push.service';

export type NotificationPreferences = {
  emailEnabled: boolean;
  browserEnabled: boolean;
  newSubmissionsEnabled: boolean;
  gradesEnabled: boolean;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly mailService: MailService,
    private readonly webPushService: WebPushService
  ) {}

  getPreferences(user: User): NotificationPreferences {
    return {
      emailEnabled: user.emailNotificationsEnabled ?? true,
      browserEnabled: user.browserNotificationsEnabled ?? false,
      newSubmissionsEnabled: user.submissionNotificationsEnabled ?? true,
      gradesEnabled: user.gradeNotificationsEnabled ?? true,
    };
  }

  getPushPublicKey(): string {
    return this.webPushService.getPublicKey();
  }

  subscribePush(user: User, input: SavePushSubscriptionDto, userAgent?: string): Promise<void> {
    return this.webPushService.subscribe(user, input, userAgent);
  }

  unsubscribePush(user: User, endpoint: string): Promise<boolean> {
    return this.webPushService.unsubscribe(user, endpoint);
  }

  async sendNewSubmissionNotifications(
    teacher: User | undefined,
    student: User,
    assignment: Assignment,
    submissionId: string
  ): Promise<void> {
    await Promise.all([
      this.sendNewSubmissionEmail(teacher, student, assignment),
      this.sendNewSubmissionPush(teacher, student, assignment, submissionId),
    ]);
  }

  async sendPublishedGradeNotifications(
    student: User,
    assignment: Assignment,
    evaluation: Evaluation
  ): Promise<void> {
    await Promise.all([
      this.sendPublishedGradeEmail(student, assignment, evaluation),
      this.sendPublishedGradePush(student, assignment, evaluation),
    ]);
  }

  async updatePreferences(
    user: User,
    input: UpdateNotificationPreferencesDto
  ): Promise<NotificationPreferences> {
    const changes: Partial<User> = {};
    if (input.emailEnabled !== undefined) changes.emailNotificationsEnabled = input.emailEnabled;
    if (input.browserEnabled !== undefined)
      changes.browserNotificationsEnabled = input.browserEnabled;
    if (input.newSubmissionsEnabled !== undefined)
      changes.submissionNotificationsEnabled = input.newSubmissionsEnabled;
    if (input.gradesEnabled !== undefined) changes.gradeNotificationsEnabled = input.gradesEnabled;

    if (Object.keys(changes).length > 0) {
      await this.userRepository.update(user.id, changes);
      Object.assign(user, changes);
    }

    return this.getPreferences(user);
  }

  async sendNewSubmissionEmail(
    teacher: User | undefined,
    student: User,
    assignment: Assignment
  ): Promise<void> {
    if (
      !teacher ||
      teacher.emailNotificationsEnabled === false ||
      teacher.submissionNotificationsEnabled === false
    )
      return;

    try {
      await this.mailService.sendNewSubmissionNotification(teacher, student, assignment);
    } catch (error) {
      this.logger.error(
        `No se pudo enviar la notificación de nueva entrega al usuario ${teacher.id}.`,
        error instanceof Error ? error.stack : undefined
      );
    }
  }

  async sendPublishedGradeEmail(
    student: User,
    assignment: Assignment,
    evaluation: Evaluation
  ): Promise<void> {
    if (student.emailNotificationsEnabled === false || student.gradeNotificationsEnabled === false)
      return;

    try {
      await this.mailService.sendGradePublishedNotification(student, assignment, evaluation);
    } catch (error) {
      this.logger.error(
        `No se pudo enviar la notificación de calificación al usuario ${student.id}.`,
        error instanceof Error ? error.stack : undefined
      );
    }
  }

  private async sendNewSubmissionPush(
    teacher: User | undefined,
    student: User,
    assignment: Assignment,
    submissionId: string
  ): Promise<void> {
    if (
      !teacher ||
      teacher.browserNotificationsEnabled !== true ||
      teacher.submissionNotificationsEnabled === false
    )
      return;

    await this.webPushService.sendToUser(teacher.id, {
      title: 'Nueva entrega',
      body: `${student.name} ${student.last_name} envió “${assignment.title}” para revisión.`,
      url: `/teacher/assignments/${assignment.id}`,
      tag: `submission:${submissionId}`,
    });
  }

  private async sendPublishedGradePush(
    student: User,
    assignment: Assignment,
    evaluation: Evaluation
  ): Promise<void> {
    if (student.browserNotificationsEnabled !== true || student.gradeNotificationsEnabled === false)
      return;

    await this.webPushService.sendToUser(student.id, {
      title: 'Calificación publicada',
      body: `Ya puedes consultar la calificación de “${assignment.title}”.`,
      url: `/evaluation?submission=${evaluation.submission.id}`,
      tag: `grade:${evaluation.id}`,
    });
  }
}
