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

/** Persistent and revocable; its lifetime is independent of any web session. */
@Entity({ name: 'telegram_links' })
@Index('UQ_telegram_links_active_user', ['userId'], { unique: true, where: '"revoked_at" IS NULL' })
@Index('UQ_telegram_links_active_telegram_user', ['telegramUserId'], {
  unique: true,
  where: '"revoked_at" IS NULL',
})
export class TelegramLinkEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /** Telegram ids exceed 32 bits; keep them as strings. */
  @Column({ name: 'telegram_user_id', type: 'bigint' })
  telegramUserId: string;

  @Column({ name: 'chat_id', type: 'bigint' })
  chatId: string;

  /** A preference only: access is revalidated on every use. */
  @Column({ name: 'selected_course_id', type: 'uuid', nullable: true })
  selectedCourseId?: string | null;

  @CreateDateColumn({ name: 'linked_at', type: 'timestamp with time zone' })
  linkedAt: Date;

  @Column({ name: 'revoked_at', type: 'timestamp with time zone', nullable: true })
  revokedAt?: Date | null;
}
