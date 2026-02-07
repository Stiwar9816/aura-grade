import { ObjectType, Field } from '@nestjs/graphql';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import type { User } from 'src/user/entities/user.entity';
import type { Assignment } from 'src/assignment/entities/assignment.entity';

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

  // Relations - Many-to-One with User (Profesor creador del curso)
  @ManyToOne(() => require('../../user/entities/user.entity').User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  @Field(() => require('../../user/entities/user.entity').User)
  user: User;

  // Relations - Many-to-Many with User (Estudiantes del curso)
  @ManyToMany(() => require('../../user/entities/user.entity').User, (user: User) => user.courses)
  @JoinTable({
    name: 'course_users', // Nombre de la tabla intermedia
    joinColumn: { name: 'courseId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'userId', referencedColumnName: 'id' },
  })
  @Field(() => [require('../../user/entities/user.entity').User], { nullable: true })
  users?: User[];

  // Relations - One-to-Many with Assignment
  @OneToMany(
    () => require('../../assignment/entities/assignment.entity').Assignment,
    (assignment: Assignment) => assignment.course
  )
  @Field(() => [require('../../assignment/entities/assignment.entity').Assignment], {
    nullable: true,
  })
  assignments?: Assignment[];

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;
}
