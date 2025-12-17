import { ObjectType, Field, Int } from '@nestjs/graphql';
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

@ObjectType()
export class CriterionLevel {
  @ApiProperty({ example: 5, description: 'Score assigned to this level' })
  @Column({ type: 'integer' })
  @Field(() => Int)
  score: number;

  @ApiProperty({ example: 'Excellent performance.', description: 'Level description' })
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

  @ApiProperty({ example: 5, description: 'Max points' })
  @Column({
    type: 'integer',
    default: 0,
  })
  @Field(() => Int)
  maxPoints: number;

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
    (rubric: any) => rubric.criteria,
    { nullable: false, onDelete: 'CASCADE' }
  )
  @JoinColumn({ name: 'rubric_id' })
  @Field(() => require('../../rubric/entities/rubric.entity').Rubric, { nullable: false })
  rubric: Rubric;
}
