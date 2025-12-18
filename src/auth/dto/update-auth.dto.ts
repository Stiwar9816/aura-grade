// NestJS
import { PartialType } from '@nestjs/swagger';
// DTO
import { CreateUserDto } from './create-user.dto';
// GraphQL
import { Field } from '@nestjs/graphql';

export class UpdateAuthDto extends PartialType(CreateUserDto) {
  @Field(() => String)
  id: string;
}
