import { InputType, Field, Float } from '@nestjs/graphql';
import { IsNumber, IsString } from 'class-validator';

@InputType()
export class CreateRubricInput {
  @IsString()
  @Field(() => String, { description: 'Title of the rubric' })
  title: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Field(() => Float, { description: 'Max total score of the rubric' })
  maxTotalScore: number;
}
