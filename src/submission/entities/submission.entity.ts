import { ObjectType, Field, ID } from '@nestjs/graphql';
// TypeORM
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  ManyToOne,
  OneToOne,
} from 'typeorm';
// Swagger
import { ApiProperty } from '@nestjs/swagger';
// Enums
import { SubmissionStatus } from 'src/enums';
// Entities
import { Assignment } from 'src/assignment/entities/assignment.entity';
import { User } from 'src/user/entities/user.entity';
import type { Evaluation } from 'src/evaluation/entities/evaluation.entity';

@Entity({ name: 'submissions' })
@ObjectType()
export class Submission {
  @ApiProperty({
    example: '2ad0bc6e-7c63-43bd-ad90-feb291d985b4',
    description: 'Submission ID',
    uniqueItems: true,
    format: 'uuid',
  })
  @PrimaryGeneratedColumn('uuid')
  @Field(() => ID)
  id: string;

  @ApiProperty({
    example: 'https://example.com/file.docx',
    description: 'URL of the file stored (Cloudinary)',
    format: 'uri',
  })
  @Column({ type: 'text' })
  @Field(() => String, { description: 'URL of the file stored (Cloudinary)' })
  fileUrl: string;

  @ApiProperty({
    example: 'Extracted text from the document for the AI',
    description: 'Extracted text from the document for the AI',
    nullable: true,
  })
  @Column({ type: 'text', nullable: true })
  @Field(() => String, {
    nullable: true,
    description: 'Extracted text from the document for the AI',
  })
  extractedText?: string;

  @ApiProperty({
    example: SubmissionStatus.PENDING,
    description: 'Submission status',
    enum: SubmissionStatus,
    default: SubmissionStatus.PENDING,
  })
  @Column({
    type: 'enum',
    enum: SubmissionStatus,
    default: SubmissionStatus.PENDING,
  })
  @Field(() => SubmissionStatus)
  status: SubmissionStatus;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  @Field(() => Date)
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  @Field(() => Date)
  updatedAt: Date;

  // Relations
  @ManyToOne(
    () => require('../../user/entities/user.entity').User,
    (user: User) => user.submissions,
    { nullable: false, onDelete: 'CASCADE' }
  )
  @JoinColumn({ name: 'student_id' })
  @Field(() => require('../../user/entities/user.entity').User)
  student: User;

  @ManyToOne(
    () => require('../../assignment/entities/assignment.entity').Assignment,
    (assignment: Assignment) => assignment.submissions,
    { nullable: false, onDelete: 'CASCADE' }
  )
  @JoinColumn({ name: 'assignment_id' })
  @Field(() => require('../../assignment/entities/assignment.entity').Assignment)
  assignment: Assignment;

  @OneToOne(
    () => require('../../evaluation/entities/evaluation.entity').Evaluation,
    (evaluation: Evaluation) => evaluation.submission
  )
  @Field(() => require('../../evaluation/entities/evaluation.entity').Evaluation, {
    nullable: true,
  })
  evaluation?: Evaluation;
}
