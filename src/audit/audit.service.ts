import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { User } from '../user/entities/user.entity';
import { AuditLog } from './entities/audit-log.entity';

export type CreateAuditLog = Omit<AuditLog, 'id' | 'createdAt'>;

export type AuditLogFilters = {
  page: number;
  limit: number;
  search?: string;
  action?: string;
};

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>
  ) {}

  async record(input: CreateAuditLog): Promise<void> {
    await this.auditRepository.save(this.auditRepository.create(input));
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
}
