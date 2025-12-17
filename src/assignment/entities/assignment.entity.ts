import { ObjectType, Field, ID } from '@nestjs/graphql';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from 'src/user/entities/user.entity';
import { Rubric } from 'src/rubric/entities/rubric.entity';

@Entity({ name: 'assignments' })
@ObjectType()
export class Assignment {
  @ApiProperty({
    example: '2ad0bc6e-7c63-43bd-ad90-feb291d985b4',
    description: 'Assignment ID',
    uniqueItems: true,
    format: 'uuid',
  })
  @PrimaryGeneratedColumn('uuid')
  @Field(() => ID)
  id: string;

  @ApiProperty({
    example: 'Assignment name',
    description: 'Assignment name',
  })
  @Column({ type: 'text' })
  @Field(() => String)
  title: string;

  @ApiProperty({
    example: 'Assignment description',
    description: 'Assignment description',
  })
  @Column({ type: 'text' })
  @Field(() => String)
  description: string;

  @ApiProperty({
    example: '2025-12-16T19:28:35.000Z',
    description: 'Assignment due date',
  })
  @Column({ type: 'timestamp with time zone' })
  @Field(() => Date)
  dueDate: Date;

  @ApiProperty({
    example: true,
    description: 'Assignment is active',
  })
  @Column({ type: 'boolean', default: true })
  @Field(() => Boolean)
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  @Field(() => Date)
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;

  // Relations
  @ManyToOne(
    () => require('../../user/entities/user.entity').User,
    (user: any) => user.assignments,
    { nullable: false }
  )
  @JoinColumn({ name: 'teacher_id' })
  @Field(() => require('../../user/entities/user.entity').User)
  teacher: User;

  @ManyToOne(() => require('../../rubric/entities/rubric.entity').Rubric, { nullable: false })
  @JoinColumn({ name: 'rubric_id' })
  @Field(() => require('../../rubric/entities/rubric.entity').Rubric)
  rubric: Rubric;

  // @OneToMany(
  //   () => require('../../submission/entities/submission.entity').Submission,
  //   (submission: any) => submission.assignment
  // )
  // @Field(() => [require('../../submission/entities/submission.entity').Submission], { nullable: 'itemsAndList' })
  // submissions?: Submission[];
}
