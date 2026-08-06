import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AuditJobData, AuditService } from './audit.service';

@Processor('audit', { concurrency: 4 })
export class AuditProcessor extends WorkerHost {
  constructor(private readonly auditService: AuditService) {
    super();
  }

  async process(job: Job<AuditJobData, { persisted: true }, string>): Promise<{ persisted: true }> {
    await this.auditService.record(job.data);
    return { persisted: true };
  }
}
