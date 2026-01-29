// Decorators/GraphQl
import { InputType, Field, PartialType, ID } from '@nestjs/graphql';
// Validators
import { IsArray, IsOptional, IsUUID } from 'class-validator';
// Dto
import { CreateCourseInput } from './create-course.input';

@InputType()
export class UpdateCourseInput extends PartialType(CreateCourseInput) {
  @IsUUID()
  @Field(() => ID, {
    description: 'Id automatically generated in uuid format',
  })
  id: string;

  @Field(() => [ID], { nullable: true })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  studentsIds?: string[];
}
