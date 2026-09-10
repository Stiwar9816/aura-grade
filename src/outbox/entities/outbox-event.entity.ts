import { Column, CreateDateColumn, Entity, PrimaryColumn, Index } from 'typeorm';

export type OutboxKind = 'grading' | 'new-submission' | 'grade-published';

@Entity('outbox_events')
export class OutboxEvent {
  @PrimaryColumn({ type: 'varchar', length: 160 })
  id: string;

  @Column({ type: 'varchar', length: 32 })
  kind: OutboxKind;

  @Column({ name: 'aggregate_id', type: 'uuid' })
  aggregateId: string;

  @Index()
  @Column({ name: 'dispatched_at', type: 'timestamptz', nullable: true })
  dispatchedAt: Date | null;

  @Column({ name: 'locked_until', type: 'timestamptz', nullable: true })
  lockedUntil: Date | null;

  @Column({ name: 'lease_token', type: 'uuid', nullable: true })
  leaseToken: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
