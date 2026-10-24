import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { DocumentExtractionState, DocumentVersionStatus } from '../document.enums';
import { CourseDocument } from './course-document.entity';
import type { DocumentPage } from '../document-extraction.service';

@Entity('course_document_versions')
export class CourseDocumentVersion {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'document_id', type: 'uuid' }) documentId: string;
  @ManyToOne(() => CourseDocument, (d) => d.versions, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'document_id' })
  document: CourseDocument;
  @Column({ type: 'integer' }) version: number;
  @Column({ type: 'text', default: DocumentVersionStatus.DRAFT }) status: DocumentVersionStatus;
  @Column({ name: 'original_name', type: 'varchar', length: 255 }) originalName: string;
  @Column({ type: 'text' }) format: 'pdf' | 'docx';
  @Column({ name: 'size_bytes', type: 'integer' }) sizeBytes: number;
  @Column({ name: 'storage_public_id', type: 'text' }) storagePublicId: string;
  @Column({ name: 'content_hash', type: 'varchar', length: 64 }) contentHash: string;
  @Column({ name: 'idempotency_key', type: 'uuid' }) idempotencyKey: string;
  @Column({ name: 'extraction_state', type: 'text' }) extractionState: DocumentExtractionState;
  @Column({ name: 'extracted_text', type: 'text' }) extractedText: string;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) pages: DocumentPage[];
  @Column({ name: 'uploaded_by_id', type: 'uuid' }) uploadedById: string;
  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'uploaded_by_id' })
  uploadedBy: User;
  @Column({ name: 'reviewed_by_id', type: 'uuid', nullable: true }) reviewedById: string | null;
  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true }) reviewedAt: Date | null;
  @Column({ name: 'published_at', type: 'timestamptz', nullable: true }) publishedAt: Date | null;
  @Column({ name: 'archived_at', type: 'timestamptz', nullable: true }) archivedAt: Date | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
