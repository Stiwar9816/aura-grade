import { Field, InputType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
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
  @Field(() => String)
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
  @Field(() => [String])
  courseIds: string[];
}
