import { InputType, Field, ID } from '@nestjs/graphql';
// Class-validator
import { IsUUID } from 'class-validator';

@InputType()
export class CreateSubmissionInput {
  @Field(() => ID, { description: 'ID of the assignment' })
  @IsUUID('4')
  assignmentId: string;

  @Field(() => ID, {
    description: 'Unique identifier of this upload attempt; reuse when retrying the same request',
  })
  @IsUUID('4')
  idempotencyKey: string;
}
