import { Field, ID, InputType } from '@nestjs/graphql';
import { IsEnum, IsUUID } from 'class-validator';
import { InstitutionApprovalStatus } from 'src/institution';

@InputType()
export class ReviewInstitutionUserInput {
  @IsUUID('4')
  @Field(() => ID)
  userId: string;

  @IsEnum(InstitutionApprovalStatus)
  @Field(() => InstitutionApprovalStatus)
  status: InstitutionApprovalStatus;
}
