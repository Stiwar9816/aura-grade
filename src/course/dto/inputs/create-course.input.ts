import { InputType, Field } from '@nestjs/graphql';
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
