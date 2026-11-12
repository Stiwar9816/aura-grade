// GraphQL
import { InputType, Field, ID, Float } from '@nestjs/graphql';
// Validators
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import GraphQLJSON from 'graphql-type-json';
import { EvaluationAdjustmentReason } from 'src/enums';

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

  @Field(() => EvaluationAdjustmentReason, {
    nullable: true,
    description: 'Motivo por el que el docente ajustó el borrador',
  })
  @IsEnum(EvaluationAdjustmentReason)
  @IsOptional()
  adjustmentReason?: EvaluationAdjustmentReason;

  @Field(() => String, { nullable: true, description: 'Comentario breve sobre el ajuste' })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  adjustmentNote?: string;
}
