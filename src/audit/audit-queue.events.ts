import { InjectQueue, OnQueueEvent, QueueEventsHost, QueueEventsListener } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { AuthMetricsService, captureExhaustedQueueJob } from 'src/observability';

@QueueEventsListener('audit')
export class AuditQueueEvents extends QueueEventsHost {
  private readonly logger = new Logger(AuditQueueEvents.name);

  constructor(
    @InjectQueue('audit') private readonly auditQueue: Queue,
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
    const job = await this.auditQueue.getJob(jobId);
    if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;
    this.metrics.increment('audit_failed_total');
    captureExhaustedQueueJob('audit', jobId, job.attemptsMade);
    this.logger.error(`La auditoría ${jobId} agotó sus reintentos.`);
  }
}
