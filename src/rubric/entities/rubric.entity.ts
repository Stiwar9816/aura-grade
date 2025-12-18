import { ObjectType, Field, Float } from '@nestjs/graphql';
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
    example: '5.00',
    description: 'Max Total score',
  })
  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
  })
  @Field(() => Float, { description: 'Maximum score possible' })
  maxTotalScore: number;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
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
