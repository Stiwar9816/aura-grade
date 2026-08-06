import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';
import type { User } from '../user/entities/user.entity';
import { AuditLog } from './entities/audit-log.entity';
import { AuditOutcome } from './enums';
import { AuthMetricsService } from 'src/observability';

export type CreateAuditLog = Omit<AuditLog, 'id' | 'createdAt'>;
export type AuditEventInput = Omit<CreateAuditLog, 'eventKey'> & { eventKey?: string };
export type AuditJobData = Omit<CreateAuditLog, 'occurredAt'> & { occurredAt: string };

export type AuditLogFilters = {
  page: number;
  limit: number;
  search?: string;
  action?: string;
  outcome?: AuditOutcome;
};

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
    @InjectQueue('audit') private readonly auditQueue: Queue,
    private readonly metrics: AuthMetricsService
  ) {}

  async enqueue(input: AuditEventInput): Promise<void> {
    const event = this.prepareEvent(input);
    try {
      await this.auditQueue.add(
        'persist-audit',
        { ...event, occurredAt: event.occurredAt.toISOString() } satisfies AuditJobData,
        {
          jobId: event.eventKey,
          attempts: 5,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: { age: 86400, count: 5000 },
          removeOnFail: { age: 604800, count: 10000 },
        }
      );
      this.metrics.increment('audit_enqueued_total');
    } catch {
      this.metrics.increment('audit_fallback_total');
      await this.record(event);
    }
  }

  async record(input: CreateAuditLog | AuditJobData): Promise<void> {
    const occurredAt =
      input.occurredAt instanceof Date ? input.occurredAt : new Date(input.occurredAt);
    try {
      await this.auditRepository.save(
        this.auditRepository.create({ ...input, occurredAt } as CreateAuditLog)
      );
      this.metrics.increment('audit_persisted_total');
    } catch (error) {
      if ((error as { code?: string })?.code === '23505') {
        this.metrics.increment('audit_duplicate_total');
        return;
      }
      throw error;
    }
  }

  async findForAdministrator(administrator: User, filters: AuditLogFilters) {
    const page = Math.max(1, filters.page);
    const limit = Math.min(100, Math.max(1, filters.limit));
    const query = this.auditRepository
      .createQueryBuilder('audit')
      .orderBy('audit.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (!administrator.isPlatformAdmin) {
      query.where('audit.institution_id = :institutionId', {
        institutionId: administrator.institutionId,
      });
    }

    if (filters.action?.trim()) {
      query.andWhere('audit.action = :action', { action: filters.action.trim() });
    }

    if (filters.outcome) {
      query.andWhere('audit.outcome = :outcome', { outcome: filters.outcome });
    }

    if (filters.search?.trim()) {
      query.andWhere(
        `(audit.actor_name ILIKE :search OR audit.actor_email ILIKE :search
          OR audit.resource ILIKE :search OR audit.path ILIKE :search
          OR CAST(audit.changes AS text) ILIKE :search)`,
        { search: `%${filters.search.trim()}%` }
      );
    }

    const [items, total] = await query.getManyAndCount();
    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  private prepareEvent(input: AuditEventInput): CreateAuditLog {
    const occurredAt = input.occurredAt instanceof Date ? input.occurredAt : new Date();
    const eventKey =
      input.eventKey ??
      createHash('sha256')
        .update(
          [
            input.requestId ?? '',
            input.actorUserId ?? '',
            input.action,
            input.resource,
            input.resourceId ?? '',
            input.outcome,
            occurredAt.toISOString(),
          ].join('|')
        )
        .digest('hex');
    return { ...input, eventKey, occurredAt };
  }
}
