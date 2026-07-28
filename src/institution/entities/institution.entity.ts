import { Field, ID, ObjectType } from '@nestjs/graphql';
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { User } from '../../user/entities/user.entity';

@Entity({ name: 'institutions' })
@ObjectType()
export class Institution {
  @PrimaryGeneratedColumn('uuid')
  @Field(() => ID)
  id: string;

  @Column({ type: 'text' })
  @Field(() => String)
  name: string;

  @Column({ type: 'text', unique: true })
  @Field(() => String)
  slug: string;

  @Column({ name: 'email_domain', type: 'text', nullable: true })
  @Field(() => String, { nullable: true })
  emailDomain?: string;

  @Column({ type: 'boolean', default: true })
  @Field(() => Boolean)
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  @Field(() => Date)
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  @Field(() => Date)
  updatedAt: Date;

  @OneToMany(
    () => require('../../user/entities/user.entity').User,
    (user: User) => user.institution
  )
  users?: User[];
}
