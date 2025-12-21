import { QueueEventsHost, QueueEventsListener, OnQueueEvent, InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationsGateway } from 'src/notifications/notifications.gateway';
import { Submission } from './entities/submission.entity';
import { SubmissionStatus } from 'src/enums';

@QueueEventsListener('grading')
export class GradingQueueEvents extends QueueEventsHost {
  private readonly logger = new Logger(GradingQueueEvents.name);

  constructor(
    @InjectRepository(Submission)
    private readonly submissionRepository: Repository<Submission>,
    private readonly notificationsGateway: NotificationsGateway,
    @InjectQueue('grading') private readonly gradingQueue: Queue
  ) {
    super();
  }

  @OnQueueEvent('progress')
  async onProgress({ jobId, data }: { jobId: string; data: number | object }) {
    this.logger.debug(`Job ${jobId} progress: ${data}`);

    const job = await this.gradingQueue.getJob(jobId);
    if (!job) return;

    const { id } = job.data;
    const submission = await this.submissionRepository.findOne({
      where: { id },
      relations: ['student'],
    });

    if (submission) {
      this.notificationsGateway.notifyStudent(submission.student.id, {
        submissionId: id,
        progress: data,
        status: SubmissionStatus.IN_PROGRESS,
        message: this.getProgressMessage(data as number),
      });
    }
  }

  @OnQueueEvent('failed')
  async onFailed({ jobId, failedReason }: { jobId: string; failedReason: string }) {
    this.logger.error(`Job ${jobId} failed: ${failedReason}`);

    // Solo notificamos fallo definitivo si ya no quedan intentos
    const job = await this.gradingQueue.getJob(jobId);
    if (job && job.attemptsMade >= (job.opts.attempts || 1)) {
      const { id } = job.data;
      const submission = await this.submissionRepository.findOne({
        where: { id },
        relations: ['student'],
      });

      if (submission) {
        this.notificationsGateway.notifyStudent(submission.student.id, {
          submissionId: id,
          status: SubmissionStatus.FAILED,
          message: 'La evaluación falló tras varios intentos.',
        });
      }
    }
  }

  @OnQueueEvent('completed')
  async onCompleted({ jobId }: { jobId: string }) {
    this.logger.log(`Job ${jobId} completed successfully`);
  }

  private getProgressMessage(progress: number): string {
    if (progress <= 15) return 'Iniciando procesamiento...';
    if (progress <= 35) return 'Extrayendo texto del documento...';
    if (progress <= 75) return 'Analizando contenido con IA...';
    if (progress <= 95) return 'Generando calificación final...';
    return '¡Evaluación completada!';
  }
}
