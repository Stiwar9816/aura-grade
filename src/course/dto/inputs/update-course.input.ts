import { CreateCourseInput } from './create-course.input';
import { InputType, Field, PartialType } from '@nestjs/graphql';
import { IsString } from 'class-validator';

@InputType()
export class UpdateCourseInput extends PartialType(CreateCourseInput) {
  @IsString()
  @Field(() => String, {
    description: 'Id automatically generated in uuid format',
  })
  id: string;
}
