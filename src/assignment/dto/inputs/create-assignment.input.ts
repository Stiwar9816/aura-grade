// Graphql
import { InputType, Field, ID } from '@nestjs/graphql';
// Validators
import { IsBoolean, IsDate, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

@InputType()
export class CreateAssignmentInput {
  @Field(() => String, { description: 'title of the task' })
  @IsNotEmpty({ message: 'The title is required' })
  @IsString()
  title: string;

  @Field(() => String, { description: 'Detailed instructions' })
  @IsNotEmpty({ message: 'The description is required' })
  @IsString()
  description: string;

  @Field(() => Date, { description: 'Due date' })
  @IsNotEmpty()
  @IsDate()
  dueDate: Date;

  @Field(() => ID, { description: 'Rubric ID' })
  @IsUUID('4')
  rubricId: string;

  @Field(() => ID, { description: 'Course ID' })
  @IsUUID('4')
  courseId: string;

  @Field(() => ID, { description: 'Teacher ID' })
  @IsUUID('4')
  userId: string;

  @Field(() => Boolean, { nullable: true, defaultValue: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
