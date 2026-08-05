import { InputType, Field, Float } from '@nestjs/graphql';
// Validators
import { IsNumber, IsOptional, IsString } from 'class-validator';

@InputType()
export class CreateRubricInput {
  @IsString()
  @Field(() => String, { description: 'Title of the rubric' })
  title: string;

  @IsString()
  @IsOptional()
  @Field(() => String, { description: 'Description of the rubric', nullable: true })
  description?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Field(() => Float, { description: 'Max total score of the rubric' })
  maxTotalScore: number;
}
