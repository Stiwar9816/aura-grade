import { Column, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryColumn } from 'typeorm';
import { Assignment } from '../../assignment/entities/assignment.entity';
import { User } from '../../user/entities/user.entity';
import { CourseDocumentVersion } from '../../course-documents/entities/course-document-version.entity';

@Entity('course_activity_confirmations')
export class CourseActivityConfirmation {
  @PrimaryColumn({ name: 'assignment_id', type: 'uuid' }) assignmentId: string;
  @OneToOne(() => Assignment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assignment_id' })
  assignment: Assignment;
  @Column({ name: 'guide_version_id', type: 'uuid' }) guideVersionId: string;
  @ManyToOne(() => CourseDocumentVersion, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'guide_version_id' })
  guideVersion: CourseDocumentVersion;
  @Column({ name: 'schedule_version_id', type: 'uuid' }) scheduleVersionId: string;
  @ManyToOne(() => CourseDocumentVersion, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'schedule_version_id' })
  scheduleVersion: CourseDocumentVersion;
  @Column({ name: 'guide_section', type: 'varchar', length: 300 }) guideSection: string;
  @Column({ name: 'schedule_section', type: 'varchar', length: 300 }) scheduleSection: string;
  @Column({ name: 'activity_hash', type: 'varchar', length: 64 }) activityHash: string;
  @Column({ name: 'confirmed_by_id', type: 'uuid' }) confirmedById: string;
  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'confirmed_by_id' })
  confirmedBy: User;
  @Column({ name: 'confirmed_at', type: 'timestamptz' }) confirmedAt: Date;
}
