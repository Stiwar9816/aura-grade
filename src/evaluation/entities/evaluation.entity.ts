import { ObjectType, Field, ID, Float } from '@nestjs/graphql';
// TypeORM
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
// Swagger
import { ApiProperty } from '@nestjs/swagger';
// GraphQL
import { GraphQLJSON } from 'graphql-type-json';
// Entities
import type { Submission } from 'src/submission/entities/submission.entity';
import type { ReEvaluationRequest } from 'src/reevaluation/entities/reevaluation-request.entity';
// Enums
import { EvaluationOrigin, EvaluationStatus } from 'src/enums';

@Entity({ name: 'evaluations' })
@ObjectType()
export class Evaluation {
  @ApiProperty({
    example: '2ad0bc6e-7c63-43bd-ad90-feb291d985b4',
    description: 'Evaluation ID',
    uniqueItems: true,
    format: 'uuid',
  })
  @PrimaryGeneratedColumn('uuid')
  @Field(() => ID)
  id: string;

  @ApiProperty({
    example: 5.0,
    description: 'Total Score',
    format: 'float',
  })
  @Column({ type: 'decimal', precision: 5, scale: 2 })
  @Field(() => Float)
  totalScore: number;

  @Column({ name: 'legacy_total_score', type: 'decimal', precision: 5, scale: 2, nullable: true })
  legacyTotalScore?: number | null;

  @Column({ name: 'legacy_max_score', type: 'decimal', precision: 5, scale: 2, nullable: true })
  legacyMaxScore?: number | null;

  @ApiProperty({
    example: 'Great job!',
    description: 'General Feedback',
    format: 'string',
  })
  @Column({ type: 'text' })
  @Field(() => String)
  generalFeedback: string;

  @ApiProperty({
    example: { aspect1: 'feedback1', aspect2: 'feedback2' },
    description: 'Detailed Feedback',
    format: 'json',
  })
  @Column({ type: 'jsonb' })
  @Field(() => GraphQLJSON)
  detailedFeedback: any;

  @Column({ name: 'legacy_detailed_feedback', type: 'jsonb', nullable: true })
  legacyDetailedFeedback?: unknown;

  @Column({ name: 'standardization_metadata', type: 'jsonb', nullable: true })
  standardizationMetadata?: Record<string, unknown> | null;

  @ApiProperty({
    example: 'GPT-4o',
    description: 'AI Model Used',
    format: 'string',
  })
  @Column({ type: 'text', nullable: true })
  @Field(() => String, { nullable: true })
  aiModelUsed?: string;

  @ApiProperty({
    example: EvaluationOrigin.AI,
    description: 'Origin of the evaluation draft',
    enum: EvaluationOrigin,
  })
  @Column({
    type: 'enum',
    enum: EvaluationOrigin,
    default: EvaluationOrigin.AI,
  })
  @Field(() => EvaluationOrigin)
  origin: EvaluationOrigin;

  @ApiProperty({
    example: 'DRAFT',
    description: 'Evaluation Status',
    enum: EvaluationStatus,
  })
  @Column({
    type: 'enum',
    enum: EvaluationStatus,
    default: EvaluationStatus.DRAFT,
  })
  @Field(() => EvaluationStatus)
  status: EvaluationStatus;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  @Field(() => Date)
  createdAt: Date;

  // Relations
  @OneToOne(
    () => require('../../submission/entities/submission.entity').Submission,
    (submission: Submission) => submission.evaluation,
    { onDelete: 'CASCADE' }
  )
  @JoinColumn({ name: 'submission_id' })
  @Field(() => require('../../submission/entities/submission.entity').Submission)
  submission: Submission;

  @OneToOne(
    () => require('../../reevaluation/entities/reevaluation-request.entity').ReEvaluationRequest,
    (reevaluationRequest: ReEvaluationRequest) => reevaluationRequest.evaluation
  )
  @Field(
    () => require('../../reevaluation/entities/reevaluation-request.entity').ReEvaluationRequest,
    {
      nullable: true,
    }
  )
  reevaluationRequest?: ReEvaluationRequest;
}
