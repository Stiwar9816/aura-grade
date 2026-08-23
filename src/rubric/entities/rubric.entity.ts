import { ObjectType, Field, Float, Int } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';
// Decorators/Swagger
import { ApiProperty } from '@nestjs/swagger';
// Entities
import type { Criterion } from 'src/criterion/entities/criterion.entity';
import type { User } from 'src/user/entities/user.entity';
// TypeORM
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RubricAcademicLevel, RubricSource, RubricStatus } from '../enums';

@Entity({ name: 'rubrics' })
@ObjectType()
export class Rubric {
  //Doc API - ApiProperty()
  @ApiProperty({
    example: '2ad0bc6e-7c63-43bd-ad90-feb291d985b4',
    description: 'Rubric ID',
    uniqueItems: true,
    format: 'uuid',
  })
  @PrimaryGeneratedColumn('uuid')
  @Field(() => String)
  id: string;

  @ApiProperty({
    example: 'PGINS2101QDOA',
    description: 'Rubric title',
  })
  @Column({ type: 'text' })
  @Field(() => String, { description: 'Title of the rubric' })
  title: string;

  @ApiProperty({
    example: 'Description of the rubric',
    description: 'Description of the rubric',
  })
  @Column({ type: 'text', nullable: true })
  @Field(() => String, { description: 'Description of the rubric', nullable: true })
  description?: string;

  @ApiProperty({
    example: '5.00',
    description: 'Max Total score',
  })
  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 5,
  })
  @Field(() => Float, { description: 'Maximum score possible' })
  maxTotalScore: number;

  @Column({
    name: 'academic_level',
    type: 'enum',
    enum: RubricAcademicLevel,
    default: RubricAcademicLevel.UNIVERSITARIO,
  })
  @Field(() => RubricAcademicLevel)
  academicLevel: RubricAcademicLevel;

  @Column({ type: 'enum', enum: RubricStatus, default: RubricStatus.DRAFT })
  @Field(() => RubricStatus)
  status: RubricStatus;

  @Column({ type: 'enum', enum: RubricSource, default: RubricSource.MANUAL })
  @Field(() => RubricSource)
  source: RubricSource;

  @Column({ type: 'integer', default: 1 })
  @Field(() => Int)
  version: number;

  @Column({ name: 'root_rubric_id', type: 'uuid', nullable: true })
  @Field(() => String, { nullable: true })
  rootRubricId?: string | null;

  @Column({ name: 'previous_version_id', type: 'uuid', nullable: true })
  @Field(() => String, { nullable: true })
  previousVersionId?: string | null;

  @Column({ name: 'published_at', type: 'timestamp with time zone', nullable: true })
  @Field(() => Date, { nullable: true })
  publishedAt?: Date | null;

  @Column({ name: 'ai_model', type: 'text', nullable: true })
  @Field(() => String, { nullable: true })
  aiModel?: string | null;

  @Column({ name: 'prompt_version', type: 'text', nullable: true })
  @Field(() => String, { nullable: true })
  promptVersion?: string | null;

  @Column({
    name: 'legacy_max_total_score',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  legacyMaxTotalScore?: number | null;

  @Column({ name: 'standardization_metadata', type: 'jsonb', nullable: true })
  @Field(() => GraphQLJSON, { nullable: true })
  standardizationMetadata?: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  @Field(() => Date, { description: 'Creation date of the rubric' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  @Field(() => Date, { description: 'Last update date of the rubric' })
  updatedAt: Date;

  // Relations - Many-to-Many with User
  @ManyToOne(
    () => require('../../user/entities/user.entity').User,
    (user: User) => user.createdRubrics
  )
  @JoinColumn({ name: 'userId' })
  @Field(() => require('../../user/entities/user.entity').User)
  user: User;

  // Relations - Many-to-Many with Criterion
  @OneToMany(
    () => require('../../criterion/entities/criterion.entity').Criterion,
    (criterion: Criterion) => criterion.rubric,
    { cascade: true }
  )
  @Field(() => [require('../../criterion/entities/criterion.entity').Criterion])
  criteria?: Criterion[];
}
