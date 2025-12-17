// Decorators/GraphQl
import { InputType, Field, PartialType, ID } from '@nestjs/graphql';
// Decorators/Swagger
import { ApiProperty } from '@nestjs/swagger';
// Validators
import { IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';
// Dto
import { CreateUserInput } from './create-user.input';
// Enums
import { UserRoles } from 'src/auth/enums';

@InputType()
export class UpdateUserInput extends PartialType(CreateUserInput) {
  @IsUUID()
  @Field(() => ID, {
    description:
      'Id automatically generated in integer format eg: 2ad0bc6e-7c63-43bd-ad90-feb291d985b4',
  })
  id: string;

  @ApiProperty({
    description: 'User role wich can Administrator, User by default takes the user role',
    nullable: false,
    type: 'string',
  })
  @IsEnum(UserRoles)
  @Field(() => UserRoles, {
    description: 'User roles wich can Administrator, User by default takes the user role',
  })
  role: UserRoles;

  @ApiProperty({
    description: 'User role wich can Administrator, User by default takes the user role',
    nullable: false,
    type: 'boolean',
  })
  @IsOptional()
  @IsBoolean()
  @Field(() => Boolean, {
    description: 'User roles wich can Administrator, User by default takes the user role',
  })
  isActive?: boolean;
}
