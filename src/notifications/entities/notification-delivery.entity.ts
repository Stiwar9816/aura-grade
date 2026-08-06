import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationJobType,
} from '../notification-queue.constants';

@Entity({ name: 'notification_deliveries' })
@Index('UQ_notification_deliveries_event_channel', ['eventKey', 'channel'], { unique: true })
@Index('IDX_notification_deliveries_status_updated', ['status', 'updatedAt'])
export class NotificationDeliveryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_key', type: 'text' })
  eventKey: string;

  @Column({ type: 'text' })
  type: NotificationJobType;

  @Column({ type: 'text' })
  channel: NotificationChannel;

  @Column({ type: 'text', default: NotificationDeliveryStatus.PENDING })
  status: NotificationDeliveryStatus;

  @Column({ type: 'integer', default: 0 })
  attempts: number;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError?: string;

  @Column({ name: 'processing_started_at', type: 'timestamp with time zone', nullable: true })
  processingStartedAt?: Date;

  @Column({ name: 'sent_at', type: 'timestamp with time zone', nullable: true })
  sentAt?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
