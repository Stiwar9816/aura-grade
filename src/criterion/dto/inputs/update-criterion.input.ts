// Decorators/GraphQl
import { InputType, Field, ID, OmitType, PartialType } from '@nestjs/graphql';
// Validators
import { IsUUID } from 'class-validator';
// Dto
import { CreateCriterionInput } from './create-criterion.input';

@InputType()
export class UpdateCriterionInput extends PartialType(
  OmitType(CreateCriterionInput, ['rubric'] as const)
) {
  @IsUUID()
  @Field(() => ID, {
    description:
      'Id automatically generated in uuid format eg: 2ad0bc6e-7c63-43bd-ad90-feb291d985b4',
  })
  id: string;
}
