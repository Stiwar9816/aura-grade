import { InputType, Field, Float, ID } from '@nestjs/graphql';
// Validators
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
// GraphQL
import GraphQLJSON from 'graphql-type-json';

@InputType()
export class CreateEvaluationInput {
  @Field(() => Float, { description: 'Total Score' })
  @IsNumber()
  @IsNotEmpty()
  totalScore: number;

  @Field(() => String, { description: 'General Feedback' })
  @IsString()
  @IsNotEmpty()
  generalFeedback: string;

  @Field(() => GraphQLJSON, { description: 'Detailed Feedback' })
  @IsNotEmpty()
  detailedFeedback: any;

  @Field(() => ID, { description: 'Submission ID' })
  @IsUUID('4')
  submissionId: string;

  @Field(() => String, { nullable: true, description: 'AI Model Used' })
  @IsOptional()
  @IsString()
  aiModelUsed?: string;
}
