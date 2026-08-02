import { InputType, Field, Float } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { DocumentType, UserRoles } from 'src/auth/enums';

@InputType()
export class CreateUserInput {
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
    minLength: 6,
    maxLength: 30,
  })
  @IsString()
  @MinLength(6)
  @MaxLength(30)
  @Matches(/(?:(?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message: 'La contraseña debe incluir mayúsculas, minúsculas y números.',
  })
  @Field(() => String, {
    description:
      'Contraseña de usuario: mínimo 6 caracteres e incluye mayúsculas, minúsculas y un número',
  })
  password: string;

  @ApiProperty({
    description: 'User role wich can Administrator, User by default takes the user role',
    nullable: false,
    type: 'string',
  })
  @IsEnum(UserRoles)
  @Field(() => UserRoles, {
    description: 'User roles wich can Administrator, User by default takes the user role',
  })
  role: UserRoles = UserRoles.Estudiante;
}
