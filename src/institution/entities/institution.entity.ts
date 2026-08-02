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

  @Column({ name: 'legal_name', type: 'text', nullable: true })
  @Field(() => String, { nullable: true })
  legalName?: string;

  @Column({ name: 'tax_id', type: 'text', nullable: true, unique: true })
  @Field(() => String, { nullable: true })
  taxId?: string;

  @Column({ name: 'contact_email', type: 'text', nullable: true })
  @Field(() => String, { nullable: true })
  contactEmail?: string;

  @Column({ type: 'text', nullable: true })
  @Field(() => String, { nullable: true })
  phone?: string;

  @Column({ type: 'text', nullable: true })
  @Field(() => String, { nullable: true })
  address?: string;

  @Column({ type: 'text', nullable: true })
  @Field(() => String, { nullable: true })
  city?: string;

  @Column({ type: 'text', nullable: true })
  @Field(() => String, { nullable: true })
  website?: string;

  @Column({ name: 'logo_url', type: 'text', nullable: true })
  @Field(() => String, { nullable: true })
  logoUrl?: string;

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
