import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import { OutboxEvent } from './entities/outbox-event.entity';
import { NotificationJobType } from 'src/notifications/notification-queue.constants';
import { Submission } from 'src/submission/entities/submission.entity';
import { SubmissionStatus } from 'src/enums';

@Injectable()
export class OutboxService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(OutboxService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private gradingCursor = '';
  private notificationCursor = '';
  constructor(
    private readonly dataSource: DataSource,
    @InjectQueue('grading') private readonly grading: Queue,
    @InjectQueue('notifications') private readonly notifications: Queue
  ) {}
  onApplicationBootstrap() {
    this.timer = setInterval(() => {
      void this.flush();
    }, 5000);
    this.timer.unref();
    void this.flush();
  }
  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  async flush(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      for (let index = 0; index < 20; index++) {
        const leaseToken = randomUUID();
        // Claim one event atomically; no network operation holds a database transaction.
        const [event] = await this.dataSource.query(
          `UPDATE outbox_events SET locked_until = now() + interval '30 seconds', lease_token = $1
          WHERE id = (SELECT id FROM outbox_events WHERE dispatched_at IS NULL
            AND (locked_until IS NULL OR locked_until < now()) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1)
          RETURNING id, kind, aggregate_id`,
          [leaseToken]
        );
        // UPDATE ... RETURNING is [rows, count] in the pg TypeORM driver.
        const claimed = Array.isArray(event) ? event[0] : event;
        if (!claimed) break;
        try {
          await this.withTimeout(this.dispatch(claimed));
          await this.dataSource
            .getRepository(OutboxEvent)
            .update(
              { id: claimed.id, leaseToken },
              { dispatchedAt: new Date(), lockedUntil: null, leaseToken: null }
            );
        } catch (error) {
          await this.dataSource
            .getRepository(OutboxEvent)
            .update({ id: claimed.id, leaseToken }, { lockedUntil: null, leaseToken: null });
          throw error;
        }
      }
      await this.reconcile();
    } catch {
      this.logger.error(
        'Hay eventos pendientes de entregar a las colas; se reintentará automáticamente.'
      );
    } finally {
      this.running = false;
    }
  }

  private async dispatch(event: { id: string; kind: string; aggregate_id: string }): Promise<void> {
    if (event.kind === 'grading') {
      const submission = await this.dataSource
        .getRepository(Submission)
        .findOne({ where: { id: event.aggregate_id }, relations: ['evaluation'] });
      if (submission && !submission.evaluation && submission.status !== SubmissionStatus.FAILED) {
        await this.grading.add(
          'grade-submission',
          { id: submission.id },
          {
            jobId: event.id,
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: { age: 86400, count: 1000 },
            removeOnFail: { age: 604800, count: 5000 },
          }
        );
      }
      return;
    }
    const type =
      event.kind === 'new-submission'
        ? NotificationJobType.NEW_SUBMISSION
        : NotificationJobType.GRADE_PUBLISHED;
    await this.notifications.add(
      type,
      { type, aggregateId: event.aggregate_id, eventKey: event.id },
      {
        jobId: event.id,
        attempts: 5,
        backoff: { type: 'exponential', delay: 10000 },
        removeOnComplete: { age: 604800, count: 10000 },
        removeOnFail: { age: 2592000, count: 20000 },
      }
    );
  }

  private async reconcile(): Promise<void> {
    const events: OutboxEvent[] = await this.dataSource
      .getRepository(OutboxEvent)
      .createQueryBuilder('event')
      .innerJoin(Submission, 'submission', 'submission.id = event.aggregate_id')
      .where("event.kind = 'grading' AND event.dispatched_at < :cutoff", {
        cutoff: new Date(Date.now() - 300000),
      })
      .andWhere('submission.status IN (:...statuses)', {
        statuses: [SubmissionStatus.PENDING, SubmissionStatus.IN_PROGRESS],
      })
      .andWhere('event.id > :cursor', { cursor: this.gradingCursor })
      .orderBy('event.id', 'ASC')
      .take(20)
      .getMany();
    if (!events.length) this.gradingCursor = '';
    for (const event of events) {
      this.gradingCursor = event.id;
      if (!(await this.withTimeout(this.grading.getJob(event.id))))
        await this.dataSource.getRepository(OutboxEvent).update(event.id, { dispatchedAt: null });
    }
    // Rebuild lost notification jobs; delivery rows prevent repeating completed channels.
    const notifications = await this.dataSource.query(
      `SELECT event.id FROM outbox_events event
      WHERE event.kind IN ('new-submission', 'grade-published')
      AND event.id > $1
      AND event.dispatched_at < now() - interval '5 minutes'
      AND (SELECT count(*) FROM notification_deliveries delivery
        WHERE delivery.event_key = event.id AND delivery.status IN ('SENT','SKIPPED')) < 2
      ORDER BY event.id ASC LIMIT 20`,
      [this.notificationCursor]
    );
    if (!notifications.length) this.notificationCursor = '';
    for (const event of notifications) {
      this.notificationCursor = event.id;
      if (!(await this.withTimeout(this.notifications.getJob(event.id))))
        await this.dataSource.getRepository(OutboxEvent).update(event.id, { dispatchedAt: null });
    }
  }

  private async withTimeout<T>(work: Promise<T>): Promise<T> {
    let timer: NodeJS.Timeout;
    try {
      return await Promise.race([
        work,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error('Queue timeout')), 10000);
        }),
      ]);
    } finally {
      clearTimeout(timer!);
    }
  }
}
