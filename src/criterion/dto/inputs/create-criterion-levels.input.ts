// Decorators/GraphQl
import { Field, Int, InputType } from '@nestjs/graphql';
// Validators
import { IsNotEmpty, IsInt, IsString, Min } from 'class-validator';

@InputType()
export class CreateCriterionLevelsInput {
  @Field(() => Int, { description: 'Score assigned to this level' })
  @IsInt({ message: 'Score must be an integer.' })
  @Min(0, { message: 'Score cannot be negative.' })
  score: number;

  @Field(() => String, { description: 'Description of this level' })
  @IsNotEmpty({ message: 'Description cannot be empty.' })
  @IsString({ message: 'Description must be a string.' })
  description: string;
}
