import { Field, ID, InputType } from '@nestjs/graphql';
import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

@InputType()
export class CreateReEvaluationRequestInput {
  @Field(() => ID, { description: 'Evaluation ID' })
  @IsUUID('4')
  evaluationId: string;

  @Field(() => String, { description: 'Reason for requesting a re-evaluation' })
  @IsString()
  @MinLength(20)
  @MaxLength(2000)
  reason: string;
}
