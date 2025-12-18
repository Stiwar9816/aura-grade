import { InputType, Field, ID, Int } from '@nestjs/graphql';
// Class-validator
import { IsUUID, IsInt, Min, Max, IsOptional } from 'class-validator';

@InputType()
export class CreateSubmissionInput {
  @Field(() => Int, { nullable: true })
  @IsInt()
  @Min(1)
  @Max(15728640, { message: 'El archivo es demasiado grande. El límite es 15MB.' })
  @IsOptional()
  fileSize?: number; // Tamaño en bytes

  @Field(() => ID, { description: 'ID of the assignment' })
  @IsUUID('4')
  assignmentId: string;

  @Field(() => ID, { description: 'ID of the student' })
  @IsUUID('4')
  studentId: string;
}
