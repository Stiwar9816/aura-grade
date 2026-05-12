import { ObjectType, Field, ID } from '@nestjs/graphql';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ReEvaluationStatus } from 'src/enums';
import { Evaluation } from 'src/evaluation/entities/evaluation.entity';
import { User } from 'src/user/entities/user.entity';

@Entity({ name: 'reevaluation_requests' })
@ObjectType()
export class ReEvaluationRequest {
  @PrimaryGeneratedColumn('uuid')
  @Field(() => ID)
  id: string;

  @Column({ type: 'text' })
  @Field(() => String)
  reason: string;

  @Column({
    type: 'enum',
    enum: ReEvaluationStatus,
    default: ReEvaluationStatus.PENDING,
  })
  @Field(() => ReEvaluationStatus)
  status: ReEvaluationStatus;

  @Column({ type: 'text', nullable: true })
  @Field(() => String, { nullable: true })
  teacherResponse?: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  @Field(() => Date)
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  @Field(() => Date)
  updatedAt: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  @Field(() => Date, { nullable: true })
  reviewedAt?: Date;

  @OneToOne(
    () => require('../../evaluation/entities/evaluation.entity').Evaluation,
    (evaluation: Evaluation) => evaluation.reevaluationRequest,
    { nullable: false, onDelete: 'CASCADE' }
  )
  @JoinColumn({ name: 'evaluation_id' })
  @Field(() => require('../../evaluation/entities/evaluation.entity').Evaluation)
  evaluation: Evaluation;

  @ManyToOne(() => require('../../user/entities/user.entity').User, { nullable: false })
  @JoinColumn({ name: 'student_id' })
  @Field(() => require('../../user/entities/user.entity').User)
  student: User;

  @ManyToOne(() => require('../../user/entities/user.entity').User, { nullable: false })
  @JoinColumn({ name: 'teacher_id' })
  @Field(() => require('../../user/entities/user.entity').User)
  teacher: User;
}
