import { ObjectType, Field, Float, Int } from '@nestjs/graphql';
// Swagger
import { ApiProperty } from '@nestjs/swagger';
import type { Rubric } from 'src/rubric/entities/rubric.entity';
// TypeORM
import {
  Column,
  CreateDateColumn,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Entity,
} from 'typeorm';
import { RubricPerformanceLevel } from 'src/rubric/enums';

@ObjectType()
export class CriterionLevel {
  @ApiProperty({ example: 5, description: 'Score assigned to this level' })
  @Column({ type: 'decimal' })
  @Field(() => Float, {
    deprecationReason: 'Use minScore and maxScore. Kept for compatibility with older clients.',
  })
  score: number;

  @Column({ type: 'text' })
  @Field(() => String)
  label: RubricPerformanceLevel;

  @Column({ type: 'decimal' })
  @Field(() => Float)
  minScore: number;

  @Column({ type: 'decimal' })
  @Field(() => Float)
  maxScore: number;

  @ApiProperty({ example: 'Desempeño excelente.', description: 'Descripción del nivel' })
  @Column({ type: 'text' })
  @Field(() => String)
  description: string;
}

@Entity({ name: 'criteria' })
@ObjectType()
export class Criterion {
  @ApiProperty({
    example: '2ad0bc6e-7c63-43bd-ad90-feb291d985b4',
    description: 'Criterion ID',
    uniqueItems: true,
    format: 'uuid',
  })
  @PrimaryGeneratedColumn('uuid')
  @Field(() => String)
  id: string;

  @ApiProperty({
    example: 'Categorías políticas que orientan el estado moderno',
    description: 'Criterion title',
  })
  @Column({ type: 'text' })
  @Field(() => String)
  title: string;

  @Column({ type: 'text', nullable: true })
  @Field(() => String, { nullable: true })
  description?: string | null;

  @ApiProperty({ example: 5, description: 'Max points' })
  @Column({
    type: 'integer',
    default: 0,
  })
  @Field(() => Int)
  maxPoints: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  @Field(() => Float, { description: 'Percentage contribution to the final grade.' })
  weight: number;

  @Column({ name: 'sort_order', type: 'integer', default: 0 })
  @Field(() => Int)
  sortOrder: number;

  @Column({ name: 'legacy_max_points', type: 'integer', nullable: true })
  legacyMaxPoints?: number | null;

  @Column({ name: 'legacy_levels', type: 'jsonb', nullable: true })
  legacyLevels?: unknown;

  @ApiProperty({
    type: 'array',
    description: 'Criterion levels',
    items: { type: 'object', $ref: '#/components/schemas/CriterionLevel' },
  })
  @Column({
    type: 'jsonb',
    default: [],
  })
  @Field(() => [CriterionLevel], {
    description: 'Performance levels with description and score.',
  })
  levels: CriterionLevel[];

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;

  // Relations - Many-to-Many with Rubric
  @ManyToOne(
    () => require('../../rubric/entities/rubric.entity').Rubric,
    (rubric: Rubric) => rubric.criteria,
    { nullable: false, onDelete: 'CASCADE' }
  )
  @JoinColumn({ name: 'rubric_id' })
  @Field(() => require('../../rubric/entities/rubric.entity').Rubric, { nullable: false })
  rubric: Rubric;
}
