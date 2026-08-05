import { Field, ID, InputType } from '@nestjs/graphql';
import { IsEnum, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ReEvaluationStatus } from 'src/enums';

@InputType()
export class ResolveReEvaluationRequestInput {
  @Field(() => ID, { description: 'Re-evaluation request ID' })
  @IsUUID('4')
  id: string;

  @Field(() => ReEvaluationStatus, { description: 'Teacher decision' })
  @IsEnum(ReEvaluationStatus)
  status: ReEvaluationStatus;

  @Field(() => String, { description: 'Teacher response' })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  teacherResponse: string;
}
