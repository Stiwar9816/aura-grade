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
// Enums
import { DocumentType } from '../../../src/auth/enums/user-document-type.enum';
import { ApiProperty } from '@nestjs/swagger';
import { UserRoles } from 'src/auth/enums';
import { Course } from 'src/course/entities/course.entity';

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
  @Column('text', {
    select: false,
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
  @ManyToMany(() => Course, (course) => course.users)
  @Field(() => [Course], {
    nullable: true,
    description: 'Many-to-many relationship with course table',
  })
  courses?: Course[];

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
