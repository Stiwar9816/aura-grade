// Decorators/GraphQl
import { Field, ID, InputType } from '@nestjs/graphql';
// Decorators/Swagger
import { ApiProperty } from '@nestjs/swagger';
// Validators
import { IsArray, IsString, IsUUID } from 'class-validator';

@InputType()
export class AssignCoursesInput {
  @ApiProperty({
    description: 'User ID',
    nullable: false,
    type: 'string',
  })
  @IsString()
  @IsUUID('4')
  @Field(() => ID)
  userId: string;

  @ApiProperty({
    description: 'Course IDs',
    nullable: false,
    type: 'string',
    isArray: true,
  })
  @IsString({ each: true })
  @IsArray()
  @IsUUID('4', { each: true })
  @Field(() => [ID])
  courseIds: string[];
}
