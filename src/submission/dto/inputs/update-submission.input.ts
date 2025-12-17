// NestJS
import { InputType, Field, ID, PartialType } from '@nestjs/graphql';
// Class-validator
import { IsUUID, IsEnum, IsOptional, IsString } from 'class-validator';
// DTOs
import { CreateSubmissionInput } from './create-submission.input';
// Enums
import { SubmissionStatus } from 'src/enums';

@InputType()
export class UpdateSubmissionInput extends PartialType(CreateSubmissionInput) {
  @Field(() => ID, { description: 'Submission ID' })
  @IsUUID('4')
  id: string;

  @Field(() => SubmissionStatus, { nullable: true, description: 'Submission status' })
  @IsEnum(SubmissionStatus)
  @IsOptional()
  status?: SubmissionStatus;

  @Field(() => String, {
    nullable: true,
    description: 'Extracted text from the document for the AI',
  })
  @IsString()
  @IsOptional()
  extractedText?: string;
}
