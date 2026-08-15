import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Assignment } from 'src/assignment/entities/assignment.entity';
import { Evaluation } from 'src/evaluation/entities/evaluation.entity';
import { MailService } from 'src/mail/mail.service';
import { User } from 'src/user/entities/user.entity';
import { UserRoles } from 'src/auth/enums';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { SavePushSubscriptionDto } from './dto/push-subscription.dto';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import {
  InAppNotificationEntity,
  NotificationResourceType,
} from './entities/in-app-notification.entity';
import {
  AssignmentReminderKind,
  NotificationJobType,
  notificationEventKey,
} from './notification-queue.constants';
import { NotificationQueueService } from './notification-queue.service';
import { WebPushService } from './web-push.service';

export type NotificationPreferences = {
  emailEnabled: boolean;
  browserEnabled: boolean;
  newSubmissionsEnabled: boolean;
  gradesEnabled: boolean;
  remindersEnabled: boolean;
};

export type AssignmentReminderPreview = {
  assignmentId: string;
  dueDate: Date;
  pendingCount: number;
  eligibleCount: number;
  cooldownCount: number;
  canSendCount: number;
  nextAllowedAt?: Date;
};

export type AssignmentReminderSendResult = AssignmentReminderPreview & {
  queuedCount: number;
};

export type InAppNotificationView = Pick<
  InAppNotificationEntity,
  'id' | 'type' | 'title' | 'body' | 'url' | 'resourceType' | 'resourceId' | 'readAt' | 'createdAt'
>;

export type PaginatedNotifications = {
  items: InAppNotificationView[];
  page: number;
  limit: number;
  total: number;
  unreadCount: number;
  hasMore: boolean;
};

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(InAppNotificationEntity)
    private readonly inAppNotificationRepository: Repository<InAppNotificationEntity>,
    @InjectRepository(Assignment)
    private readonly assignmentRepository: Repository<Assignment>,
    private readonly mailService: MailService,
    private readonly webPushService: WebPushService,
    private readonly notificationQueue: NotificationQueueService
  ) {}

  async listNotifications(
    user: User,
    { page, limit }: ListNotificationsDto
  ): Promise<PaginatedNotifications> {
    const normalizedPage = Number(page);
    const normalizedLimit = Number(limit);
    const [items, total, unreadCount] = await Promise.all([
      this.inAppNotificationRepository.find({
        where: { recipientId: user.id },
        order: { createdAt: 'DESC' },
        skip: (normalizedPage - 1) * normalizedLimit,
        take: normalizedLimit,
      }),
      this.inAppNotificationRepository.count({ where: { recipientId: user.id } }),
      this.inAppNotificationRepository.count({
        where: { recipientId: user.id, readAt: IsNull() },
      }),
    ]);

    return {
      items: items.map((notification) => this.toView(notification)),
      page: normalizedPage,
      limit: normalizedLimit,
      total,
      unreadCount,
      hasMore: normalizedPage * normalizedLimit < total,
    };
  }

  async markNotificationRead(user: User, id: string): Promise<InAppNotificationView> {
    const notification = await this.inAppNotificationRepository.findOne({
      where: { id, recipientId: user.id },
    });
    if (!notification) throw new NotFoundException('No se encontró la notificación.');

    if (!notification.readAt) {
      notification.readAt = new Date();
      await this.inAppNotificationRepository.save(notification);
    }
    return this.toView(notification);
  }

  async markAllNotificationsRead(user: User): Promise<{ updated: number }> {
    const result = await this.inAppNotificationRepository.update(
      { recipientId: user.id, readAt: IsNull() },
      { readAt: new Date() }
    );
    return { updated: result.affected ?? 0 };
  }

  async createNewSubmissionInApp(
    teacher: User | undefined,
    student: User,
    assignment: Assignment,
    submissionId: string
  ): Promise<boolean> {
    if (!teacher || teacher.submissionNotificationsEnabled === false) return false;

    return this.createInAppNotification({
      recipientId: teacher.id,
      eventKey: notificationEventKey(NotificationJobType.NEW_SUBMISSION, submissionId),
      type: NotificationJobType.NEW_SUBMISSION,
      title: 'Nueva entrega',
      body: `${student.name} ${student.last_name} envió “${assignment.title}” para revisión.`,
      url: `/teacher/assignments/${assignment.id}`,
      resourceType: NotificationResourceType.SUBMISSION,
      resourceId: submissionId,
    });
  }

  async createPublishedGradeInApp(
    student: User,
    assignment: Assignment,
    evaluation: Evaluation
  ): Promise<boolean> {
    if (student.gradeNotificationsEnabled === false) return false;

    return this.createInAppNotification({
      recipientId: student.id,
      eventKey: notificationEventKey(NotificationJobType.GRADE_PUBLISHED, evaluation.id),
      type: NotificationJobType.GRADE_PUBLISHED,
      title: 'Calificación publicada',
      body: `Ya puedes consultar la calificación de “${assignment.title}”.`,
      url: `/evaluation?submission=${evaluation.submission.id}`,
      resourceType: NotificationResourceType.EVALUATION,
      resourceId: evaluation.id,
    });
  }

  getPreferences(user: User): NotificationPreferences {
    return {
      emailEnabled: user.emailNotificationsEnabled ?? true,
      browserEnabled: user.browserNotificationsEnabled ?? false,
      newSubmissionsEnabled: user.submissionNotificationsEnabled ?? true,
      gradesEnabled: user.gradeNotificationsEnabled ?? true,
      remindersEnabled: user.reminderNotificationsEnabled ?? true,
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
    if (input.remindersEnabled !== undefined)
      changes.reminderNotificationsEnabled = input.remindersEnabled;

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

  async getAssignmentReminderPreview(
    teacher: User,
    assignmentId: string,
    now = new Date()
  ): Promise<AssignmentReminderPreview> {
    const assignment = await this.findReminderAssignment(teacher, assignmentId, now);
    const pendingStudents = this.getPendingReminderStudents(assignment);
    const eligibleStudents = pendingStudents.filter(
      (student) => student.reminderNotificationsEnabled !== false
    );
    const cooldownUntilDates = await Promise.all(
      eligibleStudents.map((student) =>
        this.notificationQueue.getManualAssignmentReminderCooldownUntil(
          assignment.id,
          student.id,
          assignment.dueDate,
          now
        )
      )
    );
    const activeCooldowns = cooldownUntilDates.filter((date): date is Date => date instanceof Date);
    const cooldownCount = activeCooldowns.length;

    return {
      assignmentId: assignment.id,
      dueDate: assignment.dueDate,
      pendingCount: pendingStudents.length,
      eligibleCount: eligibleStudents.length,
      cooldownCount,
      canSendCount: eligibleStudents.length - cooldownCount,
      ...(cooldownCount > 0
        ? { nextAllowedAt: new Date(Math.max(...activeCooldowns.map((date) => date.getTime()))) }
        : {}),
    };
  }

  async sendManualAssignmentReminders(
    teacher: User,
    assignmentId: string,
    now = new Date()
  ): Promise<AssignmentReminderSendResult> {
    const assignment = await this.findReminderAssignment(teacher, assignmentId, now);
    const pendingStudents = this.getPendingReminderStudents(assignment);
    const eligibleStudents = pendingStudents.filter(
      (student) => student.reminderNotificationsEnabled !== false
    );
    const results = await Promise.all(
      eligibleStudents.map((student) =>
        this.notificationQueue.enqueueAssignmentReminder(
          assignment.id,
          student.id,
          assignment.dueDate,
          AssignmentReminderKind.MANUAL,
          now
        )
      )
    );
    const queuedCount = results.filter((result) => result.queued).length;
    const cooldownCount = results.length - queuedCount;

    return {
      assignmentId: assignment.id,
      dueDate: assignment.dueDate,
      pendingCount: pendingStudents.length,
      eligibleCount: eligibleStudents.length,
      cooldownCount,
      canSendCount: queuedCount,
      queuedCount,
      ...(cooldownCount > 0
        ? {
            nextAllowedAt: new Date(
              Math.max(
                ...results
                  .map((result) => result.cooldownUntil?.getTime())
                  .filter((value): value is number => typeof value === 'number')
              )
            ),
          }
        : {}),
    };
  }

  async createAssignmentReminderInApp(
    student: User,
    assignment: Assignment,
    eventKey: string
  ): Promise<boolean> {
    if (student.reminderNotificationsEnabled === false) return false;

    return this.createInAppNotification({
      recipientId: student.id,
      eventKey,
      type: NotificationJobType.ASSIGNMENT_REMINDER,
      title: 'Entrega próxima a vencer',
      body: `“${assignment.title}” vence ${this.formatDueDate(assignment.dueDate)}. Aún no registras una entrega.`,
      url: `/upload?assignment=${assignment.id}`,
      resourceType: NotificationResourceType.ASSIGNMENT,
      resourceId: assignment.id,
    });
  }

  async sendAssignmentReminderEmail(
    student: User,
    assignment: Assignment,
    idempotencyKey?: string
  ): Promise<boolean> {
    if (
      student.emailNotificationsEnabled === false ||
      student.reminderNotificationsEnabled === false
    )
      return false;

    await this.mailService.sendAssignmentReminderNotification(student, assignment, idempotencyKey);
    return true;
  }

  async sendAssignmentReminderPush(
    student: User,
    assignment: Assignment,
    eventKey: string
  ): Promise<boolean> {
    if (
      student.browserNotificationsEnabled !== true ||
      student.reminderNotificationsEnabled === false
    )
      return false;

    const delivered = await this.webPushService.sendToUser(student.id, {
      title: 'Entrega próxima a vencer',
      body: `“${assignment.title}” vence ${this.formatDueDate(assignment.dueDate)}.`,
      url: `/upload?assignment=${assignment.id}`,
      tag: eventKey,
    });
    return delivered > 0;
  }

  private async findReminderAssignment(
    teacher: User,
    assignmentId: string,
    now: Date
  ): Promise<Assignment> {
    if (teacher.role !== UserRoles.Docente)
      throw new ForbiddenException('Solo un docente puede enviar recordatorios de tareas.');

    const assignment = await this.assignmentRepository.findOne({
      where: { id: assignmentId, user: { id: teacher.id } },
      relations: ['user', 'course', 'course.users', 'submissions', 'submissions.student'],
    });
    if (!assignment)
      throw new ForbiddenException('La tarea no existe o no pertenece al docente actual.');
    if (!assignment.isActive)
      throw new BadRequestException('No se pueden recordar entregas de una tarea inactiva.');
    if (assignment.dueDate.getTime() <= now.getTime())
      throw new BadRequestException('No se pueden recordar entregas de una tarea vencida.');
    return assignment;
  }

  private getPendingReminderStudents(assignment: Assignment): User[] {
    const submittedStudentIds = new Set(
      (assignment.submissions ?? [])
        .map((submission) => submission.student?.id)
        .filter((id): id is string => Boolean(id))
    );
    const uniqueStudents = new Map<string, User>();
    for (const student of assignment.course?.users ?? []) {
      if (
        student.role === UserRoles.Estudiante &&
        student.isActive !== false &&
        !submittedStudentIds.has(student.id)
      )
        uniqueStudents.set(student.id, student);
    }
    return [...uniqueStudents.values()];
  }

  private formatDueDate(dueDate: Date): string {
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'America/Bogota',
    }).format(dueDate);
  }

  private async createInAppNotification(
    input: Pick<
      InAppNotificationEntity,
      'recipientId' | 'eventKey' | 'type' | 'title' | 'body' | 'url' | 'resourceType' | 'resourceId'
    >
  ): Promise<boolean> {
    const existing = await this.inAppNotificationRepository.findOne({
      where: { recipientId: input.recipientId, eventKey: input.eventKey },
    });
    if (existing) return false;

    try {
      await this.inAppNotificationRepository.save(this.inAppNotificationRepository.create(input));
      return true;
    } catch (error) {
      if (this.isUniqueConstraintError(error)) return false;
      throw error;
    }
  }

  private toView(notification: InAppNotificationEntity): InAppNotificationView {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      url: notification.url,
      resourceType: notification.resourceType,
      resourceId: notification.resourceId,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    };
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === '23505'
    );
  }
}
