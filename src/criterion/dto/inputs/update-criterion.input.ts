// Decorators/GraphQl
import { InputType, Field, PartialType, ID } from '@nestjs/graphql';
// Validators
import { IsArray, IsOptional, IsUUID, ValidateNested } from 'class-validator';
// Transform
import { Type } from 'class-transformer';
// Dto
import { CreateCriterionInput } from './create-criterion.input';

@InputType()
export class UpdateCriterionInput extends PartialType(CreateCriterionInput) {
  @IsUUID()
  @IsOptional()
  @Field(() => ID, {
    description:
      'Id automatically generated in uuid format eg: 2ad0bc6e-7c63-43bd-ad90-feb291d985b4',
  })
  id?: string;

  @Field(() => [UpdateCriterionInput], { nullable: true })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => UpdateCriterionInput)
  criteria?: UpdateCriterionInput[];
}
