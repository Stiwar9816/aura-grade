// Decorators/GraphQl
import { InputType, Field } from '@nestjs/graphql';
// Validators
import { IsNotEmpty, IsString, Matches } from 'class-validator';
import {
  COURSE_CODE_PATTERN,
  SGA_SUBJECT_CODE_MESSAGE,
  SGA_SUBJECT_CODE_PATTERN,
} from '../../course-code';

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
  @Matches(COURSE_CODE_PATTERN, {
    message:
      'El código del curso debe ser el del SGA: de 3 a 30 caracteres entre letras, números, guion y guion bajo.',
  })
  @Field(() => String, {
    description: 'Course code, the same one the university system (SGA) uses. Stored upper-cased.',
  })
  code_course: string;

  @IsString()
  @IsNotEmpty()
  @Matches(SGA_SUBJECT_CODE_PATTERN, { message: SGA_SUBJECT_CODE_MESSAGE })
  @Field(() => String, {
    description: 'SGA subject code inside the group (6 digits), e.g. 000067',
  })
  sga_subject_code: string;

  @IsString()
  @IsNotEmpty()
  @Field(() => String, {
    description: 'ID of the teacher/professor who created the course',
  })
  userId: string;
}
