import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from 'src/user/entities/user.entity';
import { NotificationJobType } from '../notification-queue.constants';

export enum NotificationResourceType {
  SUBMISSION = 'SUBMISSION',
  EVALUATION = 'EVALUATION',
  ASSIGNMENT = 'ASSIGNMENT',
}

@Entity({ name: 'in_app_notifications' })
@Index('UQ_in_app_notifications_recipient_event', ['recipientId', 'eventKey'], { unique: true })
@Index('IDX_in_app_notifications_recipient_created', ['recipientId', 'createdAt'])
export class InAppNotificationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'recipient_id', type: 'uuid' })
  recipientId: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipient_id' })
  recipient: User;

  @Column({ name: 'event_key', type: 'text' })
  eventKey: string;

  @Column({ type: 'text' })
  type: NotificationJobType;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'text' })
  url: string;

  @Column({ name: 'resource_type', type: 'text' })
  resourceType: NotificationResourceType;

  @Column({ name: 'resource_id', type: 'uuid' })
  resourceId: string;

  @Column({ name: 'read_at', type: 'timestamp with time zone', nullable: true })
  readAt?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;
}
