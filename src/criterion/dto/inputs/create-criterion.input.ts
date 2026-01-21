// Decorators/GraphQl
import { Field, Int, InputType } from '@nestjs/graphql';
// Validators
import { IsNotEmpty, IsInt, IsString, Min, ValidateNested, IsArray, IsUUID } from 'class-validator';
// Transform
import { Type } from 'class-transformer';
// Dto
import { CreateCriterionLevelsInput } from './create-criterion-levels.input';

@InputType()
export class CreateCriterionInput {
  @Field(() => String, { description: 'Criterion title' })
  @IsNotEmpty({ message: 'Criterion title is required.' })
  @IsString({ message: 'Criterion title must be a string.' })
  title: string;

  @Field(() => Int, { description: 'Max points' })
  @IsInt({ message: 'Max points must be an integer.' })
  @Min(1, { message: 'Max points must be at least 1.' })
  maxPoints: number;

  @Field(() => [CreateCriterionLevelsInput], { description: 'Criterion levels' })
  @IsArray({ message: 'Levels must be provided as an array.' })
  @ValidateNested({ each: true })
  @Type(() => CreateCriterionLevelsInput)
  levels: CreateCriterionLevelsInput[];

  @Field(() => String, { description: 'Rubric ID' })
  @IsNotEmpty({ message: 'Rubric ID is required.' })
  @IsUUID('4', { message: 'Rubric ID must be a valid UUID.' })
  rubric: string;
}
