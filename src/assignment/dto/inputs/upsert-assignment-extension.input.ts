import { Field, ID, InputType } from '@nestjs/graphql';
import { IsDate, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

@InputType()
export class UpsertAssignmentExtensionInput {
  @Field(() => ID)
  @IsUUID('4')
  assignmentId: string;

  @Field(() => ID)
  @IsUUID('4')
  studentId: string;

  @Field(() => Date)
  @IsDate()
  extendedDueDate: Date;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
