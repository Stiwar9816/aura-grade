// GraphQL
import { ObjectType, Field, Float, HideField } from '@nestjs/graphql';
// TypeORM
import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  ManyToMany,
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
import type { Submission } from 'src/submission/entities/submission.entity';
import type { Assignment } from 'src/assignment/entities/assignment.entity';
import type { Institution } from 'src/institution/entities/institution.entity';
import { InstitutionApprovalStatus } from 'src/institution/enums/institution-approval-status.enum';

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
  @Field(() => DocumentType, { nullable: true })
  document_type: DocumentType;

  @ApiProperty({
    example: 123456789,
    description: 'User document number',
    type: 'number',
    uniqueItems: true,
  })
  @Column({ type: 'bigint', unique: true })
  @Field(() => Float, { nullable: true })
  document_num: number;

  @ApiProperty({
    example: 123456789,
    description: 'User phone number',
    type: 'number',
    uniqueItems: true,
  })
  @Column({ type: 'bigint', unique: true })
  @Field(() => Float, { nullable: true })
  phone: number;

  @ApiProperty({
    example: 'test1@gmail.com',
    description: 'User email',
    uniqueItems: true,
    type: 'string',
  })
  @Column({ type: 'text', unique: true })
  @Field(() => String, { nullable: true })
  email: string;

  @ApiProperty({
    example: 'Abcd123',
    description: 'Contraseña del usuario',
    type: 'string',
    writeOnly: true,
  })
  @Column({ type: 'text', select: false })
  @HideField()
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

  @Column({
    type: 'enum',
    enum: InstitutionApprovalStatus,
    default: InstitutionApprovalStatus.PENDING,
  })
  @Field(() => InstitutionApprovalStatus)
  approvalStatus: InstitutionApprovalStatus;

  @Column({ name: 'institution_id', type: 'uuid' })
  institutionId: string;

  @ManyToOne(
    () => require('../../institution/entities/institution.entity').Institution,
    (institution: Institution) => institution.users,
    { nullable: false, onDelete: 'RESTRICT' }
  )
  @JoinColumn({ name: 'institution_id' })
  @Field(() => require('../../institution/entities/institution.entity').Institution)
  institution: Institution;

  @Column({ type: 'int', default: 1 })
  authVersion: number;

  @Column({ name: 'is_platform_admin', type: 'boolean', default: false })
  @Field(() => Boolean)
  isPlatformAdmin: boolean;

  @Column({ name: 'email_notifications_enabled', type: 'boolean', default: true })
  emailNotificationsEnabled?: boolean;

  @Column({ name: 'browser_notifications_enabled', type: 'boolean', default: false })
  browserNotificationsEnabled?: boolean;

  @Column({ name: 'submission_notifications_enabled', type: 'boolean', default: true })
  submissionNotificationsEnabled?: boolean;

  @Column({ name: 'grade_notifications_enabled', type: 'boolean', default: true })
  gradeNotificationsEnabled?: boolean;

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
