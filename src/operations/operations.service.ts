import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { SubmissionStatus } from '../enums';
import { FeedbackEntry } from '../feedback/entities/feedback-entry.entity';
import { FeedbackStatus } from '../feedback/feedback.enums';
import { recordOutboxEvent } from '../outbox/outbox';
import { Submission } from '../submission/entities/submission.entity';
import type { User } from '../user/entities/user.entity';

type CountRow = { status: SubmissionStatus; count: string };

@Injectable()
export class OperationsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Submission)
    private readonly submissionRepository: Repository<Submission>,
    @InjectRepository(FeedbackEntry)
    private readonly feedbackRepository: Repository<FeedbackEntry>,
    @InjectQueue('grading') private readonly gradingQueue: Queue,
    @InjectQueue('notifications') private readonly notificationQueue: Queue
  ) {}

  async summary(administrator: User) {
    const query = this.submissionRepository
      .createQueryBuilder('submission')
      .innerJoin('submission.assignment', 'assignment')
      .innerJoin('assignment.user', 'teacher')
      .select('submission.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('submission.status');
    if (!administrator.isPlatformAdmin) {
      query.where('teacher.institution_id = :institutionId', {
        institutionId: administrator.institutionId,
      });
    }
    const counts = await query.getRawMany<CountRow>();
    const byStatus = Object.fromEntries(
      Object.values(SubmissionStatus).map((status) => [status, 0])
    ) as Record<SubmissionStatus, number>;
    for (const row of counts) byStatus[row.status] = Number(row.count);

    const failuresQuery = this.submissionRepository
      .createQueryBuilder('submission')
      .innerJoinAndSelect('submission.assignment', 'assignment')
      .innerJoinAndSelect('assignment.user', 'teacher')
      .innerJoinAndSelect('submission.student', 'student')
      .where('submission.status = :status', { status: SubmissionStatus.FAILED })
      .orderBy('submission.updatedAt', 'DESC')
      .take(10);
    if (!administrator.isPlatformAdmin) {
      failuresQuery.andWhere('teacher.institution_id = :institutionId', {
        institutionId: administrator.institutionId,
      });
    }
    const failures = await failuresQuery.getMany();

    const feedbackWhere = administrator.isPlatformAdmin
      ? { status: FeedbackStatus.OPEN }
      : { status: FeedbackStatus.OPEN, institutionId: administrator.institutionId };
    const openFeedback = await this.feedbackRepository.count({ where: feedbackWhere });

    return {
      submissions: {
        byStatus,
        active: byStatus.PENDING + byStatus.IN_PROGRESS,
        failed: byStatus.FAILED,
      },
      openFeedback,
      recentFailures: failures.map((submission) => ({
        id: submission.id,
        assignmentTitle: submission.assignment.title,
        studentName: `${submission.student.name} ${submission.student.last_name}`.trim(),
        attemptCount: submission.gradingAttemptCount ?? 0,
        reason: submission.gradingFailureReason ?? 'La evaluación automática no se completó.',
        lastAttemptAt: submission.gradingLastAttemptAt ?? submission.updatedAt,
      })),
      infrastructure: administrator.isPlatformAdmin ? await this.infrastructure() : null,
      generatedAt: new Date(),
    };
  }

  async retrySubmission(administrator: User, id: string) {
    const submission = await this.submissionRepository.findOne({
      where: { id },
      relations: ['assignment', 'assignment.user', 'evaluation'],
    });
    if (!submission) throw new NotFoundException('No se encontró la entrega.');
    if (
      !administrator.isPlatformAdmin &&
      submission.assignment.user.institutionId !== administrator.institutionId
    ) {
      throw new ForbiddenException('No puedes reintentar entregas de otra institución.');
    }
    if (submission.evaluation) {
      throw new BadRequestException('La entrega ya tiene una evaluación.');
    }
    if (submission.status !== SubmissionStatus.FAILED) {
      throw new BadRequestException('Solo se pueden reintentar entregas fallidas.');
    }
    if (!submission.fileUrl)
      throw new BadRequestException('La entrega no tiene archivo disponible.');

    await this.dataSource.transaction(async (manager) => {
      const result = await manager
        .getRepository(Submission)
        .update({ id, status: SubmissionStatus.FAILED }, { status: SubmissionStatus.PENDING });
      if ((result.affected ?? 0) !== 1) {
        throw new ConflictException('La entrega ya fue tomada para reprocesamiento.');
      }
      await recordOutboxEvent(manager, 'grading', id, `grading-${id}-admin-${randomUUID()}`);
    });
    return { id, status: SubmissionStatus.PENDING };
  }

  private async infrastructure() {
    try {
      const [grading, notifications, pendingOutboxRows, failedDeliveriesRows] = await Promise.all([
        this.gradingQueue.getJobCounts('waiting', 'active', 'delayed', 'failed', 'paused'),
        this.notificationQueue.getJobCounts('waiting', 'active', 'delayed', 'failed', 'paused'),
        this.dataSource.query(
          `SELECT count(*)::int AS count, min(created_at) AS oldest
           FROM outbox_events WHERE dispatched_at IS NULL`
        ),
        this.dataSource.query(
          `SELECT count(*)::int AS count FROM notification_deliveries
           WHERE status = 'FAILED' AND updated_at >= now() - interval '24 hours'`
        ),
      ]);
      return {
        available: true,
        queues: { grading, notifications },
        outboxPending: Number(pendingOutboxRows[0]?.count ?? 0),
        oldestOutboxAt: pendingOutboxRows[0]?.oldest ?? null,
        failedDeliveries24h: Number(failedDeliveriesRows[0]?.count ?? 0),
      };
    } catch {
      return { available: false };
    }
  }
}
