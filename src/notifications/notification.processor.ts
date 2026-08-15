import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { And, LessThanOrEqual, MoreThan, Repository } from 'typeorm';
import { Assignment } from 'src/assignment/entities/assignment.entity';
import { getEffectiveAssignmentDueDate } from 'src/assignment/assignment-deadline';
import { UserRoles } from 'src/auth/enums';
import { Evaluation } from 'src/evaluation/entities/evaluation.entity';
import { AuthMetricsService } from 'src/observability';
import { Submission } from 'src/submission/entities/submission.entity';
import { NotificationDeliveryEntity } from './entities/notification-delivery.entity';
import {
  NOTIFICATIONS_QUEUE,
  AssignmentReminderKind,
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationJobData,
  NotificationJobType,
} from './notification-queue.constants';
import { NotificationQueueService } from './notification-queue.service';
import { NotificationsService } from './notifications.service';

type ChannelResult = Record<NotificationChannel, NotificationDeliveryStatus>;
type NotificationJobResult = {
  status: 'DELIVERED' | 'SOURCE_NOT_FOUND' | 'RECIPIENT_INELIGIBLE' | 'SCANNED';
  channels?: ChannelResult;
  queuedCount?: number;
};

@Processor(NOTIFICATIONS_QUEUE, { concurrency: 4 })
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    @InjectRepository(Submission)
    private readonly submissionRepository: Repository<Submission>,
    @InjectRepository(Evaluation)
    private readonly evaluationRepository: Repository<Evaluation>,
    @InjectRepository(Assignment)
    private readonly assignmentRepository: Repository<Assignment>,
    @InjectRepository(NotificationDeliveryEntity)
    private readonly deliveryRepository: Repository<NotificationDeliveryEntity>,
    private readonly notificationsService: NotificationsService,
    private readonly notificationQueue: NotificationQueueService,
    private readonly metrics: AuthMetricsService
  ) {
    super();
  }

  async process(
    job: Job<NotificationJobData, NotificationJobResult, NotificationJobType>
  ): Promise<NotificationJobResult> {
    this.assertValidJob(job.data);
    this.logger.log(`Procesando la notificación durable ${job.data.eventKey}.`);

    switch (job.data.type) {
      case NotificationJobType.NEW_SUBMISSION:
        return this.processNewSubmission(job.data);
      case NotificationJobType.GRADE_PUBLISHED:
        return this.processPublishedGrade(job.data);
      case NotificationJobType.ASSIGNMENT_REMINDER:
        return this.processAssignmentReminder(job.data);
      case NotificationJobType.DEADLINE_REMINDER_SCAN:
        return this.processDeadlineReminderScan();
    }
  }

  private async processNewSubmission(data: NotificationJobData): Promise<NotificationJobResult> {
    const submission = await this.submissionRepository.findOne({
      where: { id: data.aggregateId },
      relations: ['student', 'assignment', 'assignment.user'],
    });
    if (!submission) {
      this.metrics.increment('notification_source_missing_total');
      this.logger.warn(`No existe la entrega de la notificación ${data.eventKey}.`);
      return { status: 'SOURCE_NOT_FOUND' };
    }

    await this.notificationsService.createNewSubmissionInApp(
      submission.assignment.user,
      submission.student,
      submission.assignment,
      submission.id
    );

    const channels = await this.processChannels(data, {
      email: () =>
        this.notificationsService.sendNewSubmissionEmail(
          submission.assignment.user,
          submission.student,
          submission.assignment,
          `${data.eventKey}-email`
        ),
      push: () =>
        this.notificationsService.sendNewSubmissionPush(
          submission.assignment.user,
          submission.student,
          submission.assignment,
          submission.id
        ),
    });
    return { status: 'DELIVERED', channels };
  }

  private async processPublishedGrade(data: NotificationJobData): Promise<NotificationJobResult> {
    const evaluation = await this.evaluationRepository.findOne({
      where: { id: data.aggregateId },
      relations: ['submission', 'submission.student', 'submission.assignment'],
    });
    if (!evaluation) {
      this.metrics.increment('notification_source_missing_total');
      this.logger.warn(`No existe la calificación de la notificación ${data.eventKey}.`);
      return { status: 'SOURCE_NOT_FOUND' };
    }

    await this.notificationsService.createPublishedGradeInApp(
      evaluation.submission.student,
      evaluation.submission.assignment,
      evaluation
    );

    const channels = await this.processChannels(data, {
      email: () =>
        this.notificationsService.sendPublishedGradeEmail(
          evaluation.submission.student,
          evaluation.submission.assignment,
          evaluation,
          `${data.eventKey}-email`
        ),
      push: () =>
        this.notificationsService.sendPublishedGradePush(
          evaluation.submission.student,
          evaluation.submission.assignment,
          evaluation
        ),
    });
    return { status: 'DELIVERED', channels };
  }

  private async processDeadlineReminderScan(now = new Date()): Promise<NotificationJobResult> {
    const upperDeadline = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const upcomingWindow = And(MoreThan(now), LessThanOrEqual(upperDeadline));
    const assignments = await this.assignmentRepository.find({
      where: [
        { isActive: true, dueDate: upcomingWindow },
        { isActive: true, extensions: { extendedDueDate: upcomingWindow } },
      ],
      relations: [
        'course',
        'course.users',
        'submissions',
        'submissions.student',
        'extensions',
        'extensions.student',
      ],
    });
    let queuedCount = 0;

    for (const assignment of assignments) {
      const submittedStudentIds = new Set(
        (assignment.submissions ?? [])
          .map((submission) => submission.student?.id)
          .filter((id): id is string => Boolean(id))
      );
      const students = new Map(
        (assignment.course?.users ?? [])
          .filter(
            (student) =>
              student.role === UserRoles.Estudiante &&
              student.isActive !== false &&
              student.reminderNotificationsEnabled !== false &&
              !submittedStudentIds.has(student.id)
          )
          .map((student) => [student.id, student])
      );

      const results = await Promise.all(
        [...students.values()].flatMap((student) => {
          const dueDate = getEffectiveAssignmentDueDate(assignment, student.id);
          const remainingMs = dueDate.getTime() - now.getTime();
          if (remainingMs <= 0 || dueDate.getTime() > upperDeadline.getTime()) return [];
          const reminderKind =
            remainingMs <= 24 * 60 * 60 * 1000
              ? AssignmentReminderKind.AUTO_24H
              : AssignmentReminderKind.AUTO_48H;
          return [
            this.notificationQueue.enqueueAssignmentReminder(
              assignment.id,
              student.id,
              dueDate,
              reminderKind,
              now
            ),
          ];
        })
      );
      queuedCount += results.filter((result) => result.queued).length;
    }

    this.metrics.increment('assignment_reminder_scan_total');
    return { status: 'SCANNED', queuedCount };
  }

  private async processAssignmentReminder(
    data: NotificationJobData
  ): Promise<NotificationJobResult> {
    const assignment = await this.assignmentRepository.findOne({
      where: { id: data.aggregateId },
      relations: [
        'course',
        'course.users',
        'submissions',
        'submissions.student',
        'extensions',
        'extensions.student',
      ],
    });
    if (!assignment) {
      this.metrics.increment('notification_source_missing_total');
      return { status: 'SOURCE_NOT_FOUND' };
    }

    const student = (assignment.course?.users ?? []).find(
      (candidate) => candidate.id === data.recipientId
    );
    const hasSubmitted = (assignment.submissions ?? []).some(
      (submission) => submission.student?.id === data.recipientId
    );
    const currentDueDate = getEffectiveAssignmentDueDate(assignment, data.recipientId!);
    const isEligible =
      assignment.isActive &&
      currentDueDate.getTime() > Date.now() &&
      currentDueDate.getTime() === data.dueDateEpoch &&
      student?.role === UserRoles.Estudiante &&
      student.isActive !== false &&
      student.reminderNotificationsEnabled !== false &&
      !hasSubmitted;
    if (!student || !isEligible) {
      this.metrics.increment('assignment_reminder_ineligible_total');
      return { status: 'RECIPIENT_INELIGIBLE' };
    }

    const assignmentWithEffectiveDueDate = { ...assignment, dueDate: currentDueDate };

    await this.notificationsService.createAssignmentReminderInApp(
      student,
      assignmentWithEffectiveDueDate,
      data.eventKey
    );
    const channels = await this.processChannels(data, {
      email: () =>
        this.notificationsService.sendAssignmentReminderEmail(
          student,
          assignmentWithEffectiveDueDate,
          `${data.eventKey}-email`
        ),
      push: () =>
        this.notificationsService.sendAssignmentReminderPush(
          student,
          assignmentWithEffectiveDueDate,
          data.eventKey
        ),
    });
    return { status: 'DELIVERED', channels };
  }

  private async processChannels(
    data: NotificationJobData,
    senders: { email: () => Promise<boolean>; push: () => Promise<boolean> }
  ): Promise<ChannelResult> {
    const [email, push] = await Promise.allSettled([
      this.deliverChannel(data, NotificationChannel.EMAIL, senders.email),
      this.deliverChannel(data, NotificationChannel.PUSH, senders.push),
    ]);
    const failure = [email, push].find(
      (result): result is PromiseRejectedResult => result.status === 'rejected'
    );
    if (failure) throw failure.reason;

    return {
      [NotificationChannel.EMAIL]: (email as PromiseFulfilledResult<NotificationDeliveryStatus>)
        .value,
      [NotificationChannel.PUSH]: (push as PromiseFulfilledResult<NotificationDeliveryStatus>)
        .value,
    };
  }

  private async deliverChannel(
    data: NotificationJobData,
    channel: NotificationChannel,
    sender: () => Promise<boolean>
  ): Promise<NotificationDeliveryStatus> {
    let delivery = await this.deliveryRepository.findOne({
      where: { eventKey: data.eventKey, channel },
    });
    if (
      delivery?.status === NotificationDeliveryStatus.SENT ||
      delivery?.status === NotificationDeliveryStatus.SKIPPED
    ) {
      this.metrics.increment('notification_duplicate_total');
      return delivery.status;
    }

    if (!delivery) {
      delivery = this.deliveryRepository.create({
        eventKey: data.eventKey,
        type: data.type,
        channel,
        status: NotificationDeliveryStatus.PENDING,
        attempts: 0,
      });
    }

    delivery.status = NotificationDeliveryStatus.PROCESSING;
    delivery.attempts += 1;
    delivery.processingStartedAt = new Date();
    delivery.lastError = undefined;
    delivery = await this.deliveryRepository.save(delivery);

    try {
      const sent = await sender();
      delivery.status = sent ? NotificationDeliveryStatus.SENT : NotificationDeliveryStatus.SKIPPED;
      delivery.sentAt = sent ? new Date() : undefined;
      delivery.processingStartedAt = undefined;
      await this.deliveryRepository.save(delivery);
      this.metrics.increment(
        sent ? 'notification_channel_sent_total' : 'notification_channel_skipped_total'
      );
      return delivery.status;
    } catch (error) {
      delivery.status = NotificationDeliveryStatus.FAILED;
      delivery.processingStartedAt = undefined;
      delivery.lastError = (error instanceof Error ? error.message : String(error)).slice(0, 4000);
      await this.deliveryRepository.save(delivery);
      throw error;
    }
  }

  private assertValidJob(data: NotificationJobData): void {
    if (
      !data?.aggregateId ||
      !data.eventKey ||
      !Object.values(NotificationJobType).includes(data.type)
    )
      throw new Error('El trabajo de notificación no contiene datos válidos.');
    if (
      data.type === NotificationJobType.ASSIGNMENT_REMINDER &&
      (!data.recipientId || !data.reminderKind || !data.dueDateEpoch)
    )
      throw new Error('El recordatorio de tarea no contiene destinatario o fecha límite.');
  }
}
