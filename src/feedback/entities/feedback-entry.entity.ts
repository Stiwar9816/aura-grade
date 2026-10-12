import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { User } from '../../user/entities/user.entity';
import { FeedbackCategory, FeedbackStatus } from '../feedback.enums';

@Entity({ name: 'feedback_entries' })
@Index('IDX_feedback_institution_status_created', ['institutionId', 'status', 'createdAt'])
@Index('IDX_feedback_user_created', ['userId', 'createdAt'])
export class FeedbackEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => require('../../user/entities/user.entity').User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'institution_id', type: 'uuid' })
  institutionId: string;

  @Column({ type: 'text' })
  category: FeedbackCategory;

  @Column({ type: 'text', default: FeedbackStatus.OPEN })
  status: FeedbackStatus;

  @Column({ type: 'varchar', length: 2000 })
  message: string;

  @Column({ type: 'varchar', length: 300 })
  page: string;

  @Column({ name: 'reference_id', type: 'varchar', length: 120, nullable: true })
  referenceId?: string | null;

  @Column({ name: 'admin_note', type: 'varchar', length: 1000, nullable: true })
  adminNote?: string | null;

  @Column({ name: 'resolved_at', type: 'timestamp with time zone', nullable: true })
  resolvedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
