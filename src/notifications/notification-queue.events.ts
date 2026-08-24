import { InjectQueue, OnQueueEvent, QueueEventsHost, QueueEventsListener } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { AuthMetricsService, captureExhaustedQueueJob } from 'src/observability';
import { NOTIFICATIONS_QUEUE, NotificationJobData } from './notification-queue.constants';

@QueueEventsListener(NOTIFICATIONS_QUEUE)
export class NotificationQueueEvents extends QueueEventsHost {
  private readonly logger = new Logger(NotificationQueueEvents.name);

  constructor(
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue<NotificationJobData>,
    private readonly metrics: AuthMetricsService
  ) {
    super();
  }

  @OnQueueEvent('failed')
  async onFailed({
    jobId,
    failedReason: _failedReason,
  }: {
    jobId: string;
    failedReason: string;
  }): Promise<void> {
    const job = await this.queue.getJob(jobId);
    if (!job) return;

    if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
      this.metrics.increment('notification_exhausted_total');
      captureExhaustedQueueJob(NOTIFICATIONS_QUEUE, jobId, job.attemptsMade, {
        notification_type: job.data?.type ?? 'UNKNOWN',
      });
      this.logger.error(`La notificación ${jobId} agotó sus reintentos.`);
      return;
    }

    this.metrics.increment('notification_retry_total');
    this.logger.warn(`La notificación ${jobId} será reintentada.`);
  }

  @OnQueueEvent('completed')
  onCompleted(): void {
    this.metrics.increment('notification_job_completed_total');
  }
}
