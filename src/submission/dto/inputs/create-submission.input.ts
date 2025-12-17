import { InputType, Field, ID } from '@nestjs/graphql';
// Class-validator
import { IsNotEmpty, IsUrl, IsUUID, IsString } from 'class-validator';

@InputType()
export class CreateSubmissionInput {
  @Field(() => String, { description: 'URL the file uploaded' })
  @IsNotEmpty()
  @IsUrl()
  fileUrl: string;

  @Field(() => ID, { description: 'ID of the assignment' })
  @IsUUID('4')
  assignmentId: string;

  @Field(() => ID, { description: 'ID of the student' })
  @IsUUID('4')
  studentId: string;

  // El extractedText suele ser opcional al crear,
  // ya que un worker o servicio de OCR lo llena después.
  @Field(() => String, {
    nullable: true,
    description: 'Extracted text from the document for the AI',
  })
  @IsString()
  extractedText?: string;
}
