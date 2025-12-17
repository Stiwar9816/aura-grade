// Validator
import { IsUUID } from 'class-validator';
// Graphql
import { InputType, Field, PartialType, ID } from '@nestjs/graphql';
// DTO
import { CreateAssignmentInput } from './create-assignment.input';

@InputType()
export class UpdateAssignmentInput extends PartialType(CreateAssignmentInput) {
  @Field(() => ID, { description: 'ID of the assignment to update' })
  @IsUUID('4')
  id: string;
}
