import { Field, Float, InputType } from '@nestjs/graphql';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';
import { DocumentType } from '../enums/user-document-type.enum';
import { ApiProperty } from '@nestjs/swagger';
import { UserRoles } from '../enums';
import { IsStrongPassword, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../security';

@InputType({
  description: 'Inputs user register',
})
export class CreateUserDto {
  @ApiProperty({
    description: 'User name',
    nullable: false,
    type: 'string',
  })
  @IsString()
  @IsNotEmpty()
  @Field(() => String, { description: 'User name' })
  name: string;

  @ApiProperty({
    description: 'User lastname',
    nullable: false,
    type: 'string',
  })
  @IsString()
  @IsNotEmpty()
  @Field(() => String, { description: 'User Last_name' })
  last_name: string;

  @ApiProperty({
    description:
      'User document type [Cedula de ciudadania, Pasaporte, Registro civil, Cedula de extranjeria, Libreta militar, Tarjeta de identidad]',
    nullable: false,
    type: 'string',
  })
  @IsString()
  @IsEnum(DocumentType)
  @Field(() => DocumentType, { description: 'User document type' })
  document_type: DocumentType;

  @ApiProperty({
    description: 'User document number',
    nullable: false,
    type: 'number',
    uniqueItems: true,
  })
  @IsNumber()
  @IsPositive()
  @Field(() => Float, { description: 'User document number' })
  document_num: number;

  @ApiProperty({
    description: 'User phone',
    nullable: false,
    type: 'number',
    uniqueItems: true,
  })
  @IsNumber()
  @IsPositive()
  @Field(() => Float, { description: 'User Phone' })
  phone: number;

  @ApiProperty({
    description: 'User email',
    uniqueItems: true,
    nullable: false,
  })
  @IsEmail()
  @Field(() => String, { description: 'User Email' })
  email: string;

  @ApiProperty({
    description: 'Contraseña del usuario',
    nullable: false,
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
  })
  @IsString()
  @IsStrongPassword()
  @Field(() => String, {
    description: `Contraseña o frase única de ${PASSWORD_MIN_LENGTH} a ${PASSWORD_MAX_LENGTH} caracteres`,
  })
  password: string;

  @ApiProperty({
    description: 'User role wich can Administrator, User by default takes the user role',
    nullable: true,
    type: 'string',
    enum: UserRoles,
  })
  @IsOptional()
  @IsIn([UserRoles.Estudiante, UserRoles.Docente], {
    message: 'El registro público solo permite los roles Estudiante o Docente.',
  })
  @Field(() => UserRoles, {
    nullable: true,
    description: 'User roles wich can Administrator, User by default takes the user role',
  })
  role?: UserRoles = UserRoles.Estudiante;

  @ApiProperty({
    description: 'Institution selected during registration',
    type: 'string',
    format: 'uuid',
  })
  @IsUUID('4')
  @Field(() => String, { description: 'Institution selected during registration' })
  institutionId: string;

  @ApiProperty({
    description: 'User courses',
    nullable: true,
    type: 'string',
  })
  @IsString({ each: true })
  @IsArray()
  @IsOptional()
  @Field(() => [String], { description: 'User courses', nullable: true })
  courses?: string[];
}
