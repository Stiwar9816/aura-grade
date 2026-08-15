import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { AuthMetricsService } from 'src/observability';
import {
  NOTIFICATIONS_QUEUE,
  AssignmentReminderKind,
  NotificationJobData,
  NotificationJobType,
  assignmentReminderEventKey,
  notificationEventKey,
} from './notification-queue.constants';

const NOTIFICATION_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: 'exponential' as const, delay: 10_000 },
  removeOnComplete: { age: 7 * 24 * 60 * 60, count: 10_000 },
  removeOnFail: { age: 30 * 24 * 60 * 60, count: 20_000 },
};

const MANUAL_REMINDER_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const DEADLINE_REMINDER_SCAN_INTERVAL_MS = 30 * 60 * 1000;

export type AssignmentReminderQueueResult = {
  eventKey: string;
  queued: boolean;
  cooldownUntil?: Date;
};

@Injectable()
export class NotificationQueueService implements OnModuleInit {
  constructor(
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue<NotificationJobData>,
    private readonly metrics: AuthMetricsService
  ) {}

  async onModuleInit(): Promise<void> {
    await this.registerDeadlineReminderScheduler();
  }

  enqueueNewSubmission(submissionId: string): Promise<string> {
    return this.enqueue(NotificationJobType.NEW_SUBMISSION, submissionId);
  }

  enqueuePublishedGrade(evaluationId: string): Promise<string> {
    return this.enqueue(NotificationJobType.GRADE_PUBLISHED, evaluationId);
  }

  async registerDeadlineReminderScheduler(): Promise<void> {
    await this.queue.upsertJobScheduler(
      'assignment-deadline-reminder-scan',
      { every: DEADLINE_REMINDER_SCAN_INTERVAL_MS },
      {
        name: NotificationJobType.DEADLINE_REMINDER_SCAN,
        data: {
          type: NotificationJobType.DEADLINE_REMINDER_SCAN,
          aggregateId: 'scheduled-scan',
          eventKey: 'assignment-deadline-reminder-scan',
        },
        opts: { removeOnComplete: true, removeOnFail: 100 },
      }
    );
    const scanBucket = Math.floor(Date.now() / DEADLINE_REMINDER_SCAN_INTERVAL_MS);
    const startupEventKey = `assignment-deadline-reminder-startup-${scanBucket}`;
    if (!(await this.queue.getJob(startupEventKey))) {
      await this.queue.add(
        NotificationJobType.DEADLINE_REMINDER_SCAN,
        {
          type: NotificationJobType.DEADLINE_REMINDER_SCAN,
          aggregateId: 'startup-scan',
          eventKey: startupEventKey,
        },
        {
          jobId: startupEventKey,
          attempts: 3,
          backoff: { type: 'exponential', delay: 10_000 },
          removeOnComplete: { age: 60 * 60, count: 10 },
          removeOnFail: { age: 24 * 60 * 60, count: 100 },
        }
      );
    }
  }

  async enqueueAssignmentReminder(
    assignmentId: string,
    recipientId: string,
    dueDate: Date,
    reminderKind: AssignmentReminderKind,
    now = new Date()
  ): Promise<AssignmentReminderQueueResult> {
    const manualBucket =
      reminderKind === AssignmentReminderKind.MANUAL
        ? Math.floor(now.getTime() / MANUAL_REMINDER_COOLDOWN_MS) * MANUAL_REMINDER_COOLDOWN_MS
        : undefined;
    const eventKey = assignmentReminderEventKey(
      assignmentId,
      recipientId,
      dueDate,
      reminderKind,
      manualBucket
    );
    if (reminderKind === AssignmentReminderKind.MANUAL) {
      const cooldownUntil = await this.getManualAssignmentReminderCooldownUntil(
        assignmentId,
        recipientId,
        dueDate,
        now
      );
      if (cooldownUntil) {
        this.metrics.increment('notification_duplicate_total');
        return { eventKey, queued: false, cooldownUntil };
      }
    }
    const existing = await this.queue.getJob(eventKey);
    if (existing) {
      this.metrics.increment('notification_duplicate_total');
      return { eventKey, queued: false };
    }

    await this.queue.add(
      NotificationJobType.ASSIGNMENT_REMINDER,
      {
        type: NotificationJobType.ASSIGNMENT_REMINDER,
        aggregateId: assignmentId,
        recipientId,
        reminderKind,
        dueDateEpoch: dueDate.getTime(),
        eventKey,
      },
      { ...NOTIFICATION_JOB_OPTIONS, jobId: eventKey }
    );
    this.metrics.increment('notification_queued_total');
    return { eventKey, queued: true };
  }

  async getManualAssignmentReminderCooldownUntil(
    assignmentId: string,
    recipientId: string,
    dueDate: Date,
    now = new Date()
  ): Promise<Date | undefined> {
    const currentBucket =
      Math.floor(now.getTime() / MANUAL_REMINDER_COOLDOWN_MS) * MANUAL_REMINDER_COOLDOWN_MS;
    const jobs = await Promise.all(
      [currentBucket, currentBucket - MANUAL_REMINDER_COOLDOWN_MS].map((manualBucket) =>
        this.queue.getJob(
          assignmentReminderEventKey(
            assignmentId,
            recipientId,
            dueDate,
            AssignmentReminderKind.MANUAL,
            manualBucket
          )
        )
      )
    );
    const latestTimestamp = Math.max(
      ...jobs
        .map((job) => job?.timestamp)
        .filter((timestamp): timestamp is number => typeof timestamp === 'number')
    );
    if (!Number.isFinite(latestTimestamp)) return undefined;
    const cooldownUntil = latestTimestamp + MANUAL_REMINDER_COOLDOWN_MS;
    return cooldownUntil > now.getTime() ? new Date(cooldownUntil) : undefined;
  }

  private async enqueue(type: NotificationJobType, aggregateId: string): Promise<string> {
    const eventKey = notificationEventKey(type, aggregateId);
    try {
      const existing = await this.queue.getJob(eventKey);
      if (existing) {
        this.metrics.increment('notification_duplicate_total');
        return eventKey;
      }

      await this.queue.add(
        type,
        { type, aggregateId, eventKey },
        {
          ...NOTIFICATION_JOB_OPTIONS,
          jobId: eventKey,
        }
      );
      this.metrics.increment('notification_queued_total');
      return eventKey;
    } catch (error) {
      this.metrics.increment('notification_enqueue_failed_total');
      throw error;
    }
  }
}
