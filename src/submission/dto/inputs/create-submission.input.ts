import { InputType, Field, ID } from '@nestjs/graphql';
// Class-validator
import { IsUUID } from 'class-validator';

@InputType()
export class CreateSubmissionInput {
  @Field(() => ID, { description: 'ID of the assignment' })
  @IsUUID('4')
  assignmentId: string;
}
