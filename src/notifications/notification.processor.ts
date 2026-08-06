import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { Evaluation } from 'src/evaluation/entities/evaluation.entity';
import { AuthMetricsService } from 'src/observability';
import { Submission } from 'src/submission/entities/submission.entity';
import { NotificationDeliveryEntity } from './entities/notification-delivery.entity';
import {
  NOTIFICATIONS_QUEUE,
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationJobData,
  NotificationJobType,
} from './notification-queue.constants';
import { NotificationsService } from './notifications.service';

type ChannelResult = Record<NotificationChannel, NotificationDeliveryStatus>;
type NotificationJobResult = {
  status: 'DELIVERED' | 'SOURCE_NOT_FOUND';
  channels?: ChannelResult;
};

@Processor(NOTIFICATIONS_QUEUE, { concurrency: 4 })
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    @InjectRepository(Submission)
    private readonly submissionRepository: Repository<Submission>,
    @InjectRepository(Evaluation)
    private readonly evaluationRepository: Repository<Evaluation>,
    @InjectRepository(NotificationDeliveryEntity)
    private readonly deliveryRepository: Repository<NotificationDeliveryEntity>,
    private readonly notificationsService: NotificationsService,
    private readonly metrics: AuthMetricsService
  ) {
    super();
  }

  async process(
    job: Job<NotificationJobData, NotificationJobResult, NotificationJobType>
  ): Promise<NotificationJobResult> {
    this.assertValidJob(job.data);
    this.logger.log(`Procesando la notificación durable ${job.data.eventKey}.`);

    return job.data.type === NotificationJobType.NEW_SUBMISSION
      ? this.processNewSubmission(job.data)
      : this.processPublishedGrade(job.data);
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
  }
}
