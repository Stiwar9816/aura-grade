import { ObjectType, Field, Float } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { User } from 'src/user/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
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
  @Field(() => String)
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
  @Field(() => Float)
  maxTotalScore: number;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;

  // Relations - Many-to-Many with User
  @ManyToOne(() => User, (user) => user.createdRubrics, { nullable: true })
  @Field(() => User, { nullable: true })
  users?: any;
}
