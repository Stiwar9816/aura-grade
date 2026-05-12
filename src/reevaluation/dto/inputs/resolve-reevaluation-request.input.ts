import { Field, ID, InputType } from '@nestjs/graphql';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ReEvaluationStatus } from 'src/enums';

@InputType()
export class ResolveReEvaluationRequestInput {
  @Field(() => ID, { description: 'Re-evaluation request ID' })
  @IsUUID('4')
  id: string;

  @Field(() => ReEvaluationStatus, { description: 'Teacher decision' })
  @IsEnum(ReEvaluationStatus)
  status: ReEvaluationStatus;

  @Field(() => String, { nullable: true, description: 'Teacher response' })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  teacherResponse?: string;
}
