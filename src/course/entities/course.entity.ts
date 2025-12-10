import { ObjectType, Field } from '@nestjs/graphql';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from 'src/user/entities/user.entity';

@Entity({ name: 'courses' })
@ObjectType()
export class Course {
  //Doc API - ApiProperty()
  @ApiProperty({
    example: '2ad0bc6e-7c63-43bd-ad90-feb291d985b4',
    description: 'Course ID',
    uniqueItems: true,
    format: 'uuid',
  })
  @PrimaryGeneratedColumn('uuid')
  @Field(() => String)
  id: string;

  @ApiProperty({
    example: 'Course name',
    description: 'Course name',
  })
  @Column({ type: 'text' })
  @Field(() => String)
  course_name: string;

  @ApiProperty({
    example: 'Course code',
    description: 'PGINS2101QDOA',
  })
  @Column({ type: 'text' })
  @Field(() => String)
  code_course: string;

  // Relations - Many-to-Many with User
  @ManyToMany(() => User, (user) => user.courses)
  @JoinTable({
    name: 'course_users', // Nombre de la tabla intermedia
    joinColumn: { name: 'courseId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'userId', referencedColumnName: 'id' },
  })
  @Field(() => [User], { nullable: true })
  users?: User[];

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;
}
