import { Field, Float, ID, InputType } from '@nestjs/graphql';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import GraphQLJSON from 'graphql-type-json';

@InputType()
export class CreateManualEvaluationInput {
  @Field(() => ID, { description: 'Submission ID' })
  @IsUUID('4')
  submissionId: string;

  @Field(() => Float, { description: 'Initial manual score' })
  @IsNumber()
  @Min(0)
  totalScore: number;

  @Field(() => String, { description: 'Initial manual feedback' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  generalFeedback: string;

  @Field(() => GraphQLJSON, { nullable: true, description: 'Optional criterion feedback' })
  @IsOptional()
  detailedFeedback?: unknown;
}
