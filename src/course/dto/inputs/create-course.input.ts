// Decorators/GraphQl
import { InputType, Field } from '@nestjs/graphql';
// Validators
import { IsNotEmpty, IsString } from 'class-validator';

@InputType()
export class CreateCourseInput {
  @IsString()
  @IsNotEmpty()
  @Field(() => String, {
    description: 'Name of the course',
  })
  course_name: string;

  @IsString()
  @IsNotEmpty()
  @Field(() => String, {
    description: 'Code of the course',
  })
  code_course: string;
}
