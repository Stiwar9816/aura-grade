// GraphQL
import { ObjectType, Field, Float } from '@nestjs/graphql';
// TypeORM
import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  Entity,
  JoinColumn,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
// Swagger
import { ApiProperty } from '@nestjs/swagger';
// Enums
import { UserRoles, DocumentType } from 'src/auth/enums';
// Entities
import type { Course } from 'src/course/entities/course.entity';
import { Rubric } from 'src/rubric/entities/rubric.entity';
import { Submission } from 'src/submission/entities/submission.entity';
import { Assignment } from 'src/assignment/entities/assignment.entity';

@Entity({ name: 'users' })
@ObjectType()
export class User {
  //Doc API - ApiProperty()
  @ApiProperty({
    example: '2ad0bc6e-7c63-43bd-ad90-feb291d985b4',
    description: 'User ID',
    uniqueItems: true,
    format: 'uuid',
  })
  @PrimaryGeneratedColumn('uuid')
  @Field(() => String)
  id: string;

  @ApiProperty({
    example: 'Test One',
    description: 'User name',
    type: 'string',
  })
  @Column({ type: 'text' })
  @Field(() => String)
  name: string;

  @ApiProperty({
    example: 'Test One',
    description: 'User lastname',
    type: 'string',
  })
  @Column({ type: 'text' })
  @Field(() => String)
  last_name: string;

  @ApiProperty({
    example: 'Cedula de ciudadania',
    description:
      'Document type allowed in the system [Cedula de ciudadania, Pasaporte, Registro civil, Cedula de extranjeria, Libreta militar, Tarjeta de identidad]',
    type: 'string',
  })
  @Column({ type: 'enum', enum: DocumentType })
  @Field(() => DocumentType)
  document_type: DocumentType;

  @ApiProperty({
    example: 123456789,
    description: 'User document number',
    type: 'number',
    uniqueItems: true,
  })
  @Column({ type: 'bigint', unique: true })
  @Field(() => Float)
  document_num: number;

  @ApiProperty({
    example: 123456789,
    description: 'User phone number',
    type: 'number',
    uniqueItems: true,
  })
  @Column({ type: 'bigint', unique: true })
  @Field(() => Float)
  phone: number;

  @ApiProperty({
    example: 'test1@gmail.com',
    description: 'User email',
    uniqueItems: true,
    type: 'string',
  })
  @Column({ type: 'text', unique: true })
  @Field(() => String)
  email: string;

  @ApiProperty({
    example: 'Abcd123',
    description: 'User password',
    type: 'string',
  })
  @Column({ type: 'text', select: false })
  @Field(() => String)
  password: string;

  @ApiProperty({
    example: 'true',
    description: 'User status',
    type: 'boolean',
  })
  @Column({ type: 'bool', default: true })
  @Field(() => Boolean)
  isActive: boolean;

  @ApiProperty({
    example: 'user',
    description: 'User role',
    type: 'string',
  })
  @Column({ type: 'enum', enum: UserRoles, default: UserRoles.Estudiante })
  @Field(() => UserRoles)
  role: UserRoles;

  // Relations - Many-to-Many with Course
  @ManyToMany(
    () => require('../../course/entities/course.entity').Course,
    (course: Course) => course.users
  )
  @Field(() => [require('../../course/entities/course.entity').Course], {
    nullable: true,
    description: 'Many-to-many relationship with course table',
  })
  courses?: Course[];

  @OneToMany(() => Rubric, (rubric) => rubric.user)
  @Field(() => [Rubric], {
    nullable: true,
    description: 'One-to-Many relationship with rubric table',
  })
  createdRubrics?: Rubric[];

  @OneToMany(
    () => require('../../submission/entities/submission.entity').Submission,
    (submission: any) => submission.student
  )
  @Field(() => [require('../../submission/entities/submission.entity').Submission], {
    nullable: true,
  })
  submissions?: Submission[];

  @OneToMany(
    () => require('../../assignment/entities/assignment.entity').Assignment,
    (assignment: any) => assignment.user
  )
  @Field(() => [require('../../assignment/entities/assignment.entity').Assignment], {
    nullable: true,
  })
  assignments?: Assignment[];

  // Convertimos los datos del email a minúsculas
  @BeforeInsert()
  checkFieldsBeforeInsert() {
    this.email = this.email.toLowerCase().trim();
  }

  @BeforeUpdate()
  checkFieldsBeforeUpdate() {
    this.email = this.email.toLowerCase().trim();
  }
}
