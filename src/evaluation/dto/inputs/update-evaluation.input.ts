// GraphQL
import { InputType, Field, ID, Float } from '@nestjs/graphql';
// Validators
import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import GraphQLJSON from 'graphql-type-json';

@InputType()
export class UpdateEvaluationInput {
  @Field(() => ID, { description: 'ID de la evaluación a actualizar' })
  @IsUUID('4')
  id: string;

  @Field(() => Float, { nullable: true, description: 'Calificación final' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  totalScore?: number;

  @Field(() => String, { nullable: true, description: 'Retroalimentación final' })
  @IsString()
  @IsOptional()
  generalFeedback?: string;

  @Field(() => GraphQLJSON, { nullable: true, description: 'Retroalimentación detallada' })
  @IsOptional()
  detailedFeedback?: unknown;
}
