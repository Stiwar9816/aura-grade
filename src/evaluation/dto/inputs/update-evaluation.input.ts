// GraphQL
import { InputType, Field, PartialType, ID } from '@nestjs/graphql';
// Validators
import { IsUUID } from 'class-validator';
// DTOs
import { CreateEvaluationInput } from './create-evaluation.input';

@InputType()
export class UpdateEvaluationInput extends PartialType(CreateEvaluationInput) {
  @Field(() => ID, { description: 'ID de la evaluación a actualizar' })
  @IsUUID('4')
  id: string;
}
