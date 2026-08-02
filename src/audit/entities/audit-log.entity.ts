import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'audit_logs' })
@Index('IDX_audit_logs_institution_created', ['institutionId', 'createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId?: string;

  @Column({ name: 'actor_name', type: 'text' })
  actorName: string;

  @Column({ name: 'actor_email', type: 'text', nullable: true })
  actorEmail?: string;

  @Column({ name: 'institution_id', type: 'uuid' })
  institutionId: string;

  @Column({ name: 'ip_address', type: 'inet', nullable: true })
  ipAddress?: string;

  @Column({ type: 'text' })
  action: string;

  @Column({ type: 'text' })
  resource: string;

  @Column({ name: 'resource_id', type: 'text', nullable: true })
  resourceId?: string;

  @Column({ type: 'jsonb', nullable: true })
  changes?: Record<string, unknown>;

  @Column({ name: 'request_id', type: 'text', nullable: true })
  requestId?: string;

  @Column({ type: 'text', nullable: true })
  path?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;
}
