import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Course } from '../../course/entities/course.entity';
import { CourseDocumentKind } from '../document.enums';
import type { CourseDocumentVersion } from './course-document-version.entity';

@Entity('course_documents')
export class CourseDocument {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'course_id', type: 'uuid' }) courseId: string;
  @ManyToOne(() => Course, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'course_id' })
  course: Course;
  @Column({ type: 'varchar', length: 200 }) title: string;
  @Column({ type: 'text' }) kind: CourseDocumentKind;
  @Column({ name: 'next_version', type: 'integer', default: 1 }) nextVersion: number;
  @Column({ name: 'last_published_version', type: 'integer', default: 0 })
  lastPublishedVersion: number;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @OneToMany(
    () => require('./course-document-version.entity').CourseDocumentVersion,
    (v: CourseDocumentVersion) => v.document
  )
  versions?: CourseDocumentVersion[];
}
