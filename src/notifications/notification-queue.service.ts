import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { AuthMetricsService } from 'src/observability';
import {
  NOTIFICATIONS_QUEUE,
  NotificationJobData,
  NotificationJobType,
  notificationEventKey,
} from './notification-queue.constants';

const NOTIFICATION_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: 'exponential' as const, delay: 10_000 },
  removeOnComplete: { age: 7 * 24 * 60 * 60, count: 10_000 },
  removeOnFail: { age: 30 * 24 * 60 * 60, count: 20_000 },
};

@Injectable()
export class NotificationQueueService {
  constructor(
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue<NotificationJobData>,
    private readonly metrics: AuthMetricsService
  ) {}

  enqueueNewSubmission(submissionId: string): Promise<string> {
    return this.enqueue(NotificationJobType.NEW_SUBMISSION, submissionId);
  }

  enqueuePublishedGrade(evaluationId: string): Promise<string> {
    return this.enqueue(NotificationJobType.GRADE_PUBLISHED, evaluationId);
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
