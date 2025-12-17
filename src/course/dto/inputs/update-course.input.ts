// Decorators/GraphQl
import { InputType, Field, PartialType, ID } from '@nestjs/graphql';
// Validators
import { IsUUID } from 'class-validator';
// Dto
import { CreateCourseInput } from './create-course.input';

@InputType()
export class UpdateCourseInput extends PartialType(CreateCourseInput) {
  @IsUUID()
  @Field(() => ID, {
    description: 'Id automatically generated in uuid format',
  })
  id: string;
}
