import { Field, ID, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

@InputType()
export class CreateReEvaluationRequestInput {
  @Field(() => ID, { description: 'Evaluation ID' })
  @IsUUID('4')
  evaluationId: string;

  @Field(() => String, { description: 'Reason for requesting a re-evaluation' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
