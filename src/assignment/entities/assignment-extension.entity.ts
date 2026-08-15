import { Field, ID, ObjectType } from '@nestjs/graphql';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import type { User } from 'src/user/entities/user.entity';
import type { Assignment } from './assignment.entity';

@Entity({ name: 'assignment_extensions' })
@ObjectType()
@Unique('UQ_assignment_extensions_assignment_student', ['assignment', 'student'])
@Index('IDX_assignment_extensions_student_due_date', ['student', 'extendedDueDate'])
export class AssignmentExtension {
  @PrimaryGeneratedColumn('uuid')
  @Field(() => ID)
  id: string;

  @Column({ name: 'extended_due_date', type: 'timestamp with time zone' })
  @Field(() => Date)
  extendedDueDate: Date;

  @Column({ type: 'text', nullable: true })
  @Field(() => String, { nullable: true })
  reason?: string;

  @ManyToOne(
    () => require('./assignment.entity').Assignment,
    (assignment: Assignment) => assignment.extensions,
    { nullable: false, onDelete: 'CASCADE' }
  )
  @JoinColumn({ name: 'assignment_id' })
  @Field(() => require('./assignment.entity').Assignment)
  assignment: Assignment;

  @ManyToOne(() => require('../../user/entities/user.entity').User, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'student_id' })
  @Field(() => require('../../user/entities/user.entity').User)
  student: User;

  @ManyToOne(() => require('../../user/entities/user.entity').User, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'granted_by_id' })
  @Field(() => require('../../user/entities/user.entity').User)
  grantedBy: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  @Field(() => Date)
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  @Field(() => Date)
  updatedAt: Date;
}
