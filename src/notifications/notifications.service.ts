import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Assignment } from 'src/assignment/entities/assignment.entity';
import { MailService } from 'src/mail/mail.service';
import { User } from 'src/user/entities/user.entity';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';

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
    private readonly mailService: MailService
  ) {}

  getPreferences(user: User): NotificationPreferences {
    return {
      emailEnabled: user.emailNotificationsEnabled ?? true,
      browserEnabled: user.browserNotificationsEnabled ?? false,
      newSubmissionsEnabled: user.submissionNotificationsEnabled ?? true,
      gradesEnabled: user.gradeNotificationsEnabled ?? true,
    };
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
    assignmentTitle: string,
    score?: number
  ): Promise<void> {
    if (student.emailNotificationsEnabled === false || student.gradeNotificationsEnabled === false)
      return;

    try {
      await this.mailService.sendGradePublishedNotification(student, assignmentTitle, score);
    } catch (error) {
      this.logger.error(
        `No se pudo enviar la notificación de calificación al usuario ${student.id}.`,
        error instanceof Error ? error.stack : undefined
      );
    }
  }
}
