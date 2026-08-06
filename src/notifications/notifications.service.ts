import { Injectable } from '@nestjs/common';
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
    assignment: Assignment,
    idempotencyKey?: string
  ): Promise<boolean> {
    if (
      !teacher ||
      teacher.emailNotificationsEnabled === false ||
      teacher.submissionNotificationsEnabled === false
    )
      return false;

    await this.mailService.sendNewSubmissionNotification(
      teacher,
      student,
      assignment,
      idempotencyKey
    );
    return true;
  }

  async sendPublishedGradeEmail(
    student: User,
    assignment: Assignment,
    evaluation: Evaluation,
    idempotencyKey?: string
  ): Promise<boolean> {
    if (student.emailNotificationsEnabled === false || student.gradeNotificationsEnabled === false)
      return false;

    await this.mailService.sendGradePublishedNotification(
      student,
      assignment,
      evaluation,
      idempotencyKey
    );
    return true;
  }

  async sendNewSubmissionPush(
    teacher: User | undefined,
    student: User,
    assignment: Assignment,
    submissionId: string
  ): Promise<boolean> {
    if (
      !teacher ||
      teacher.browserNotificationsEnabled !== true ||
      teacher.submissionNotificationsEnabled === false
    )
      return false;

    const delivered = await this.webPushService.sendToUser(teacher.id, {
      title: 'Nueva entrega',
      body: `${student.name} ${student.last_name} envió “${assignment.title}” para revisión.`,
      url: `/teacher/assignments/${assignment.id}`,
      tag: `submission:${submissionId}`,
    });
    return delivered > 0;
  }

  async sendPublishedGradePush(
    student: User,
    assignment: Assignment,
    evaluation: Evaluation
  ): Promise<boolean> {
    if (student.browserNotificationsEnabled !== true || student.gradeNotificationsEnabled === false)
      return false;

    const delivered = await this.webPushService.sendToUser(student.id, {
      title: 'Calificación publicada',
      body: `Ya puedes consultar la calificación de “${assignment.title}”.`,
      url: `/evaluation?submission=${evaluation.submission.id}`,
      tag: `grade:${evaluation.id}`,
    });
    return delivered > 0;
  }
}
