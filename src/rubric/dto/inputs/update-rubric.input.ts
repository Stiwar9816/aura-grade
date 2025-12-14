import { InputType, Field, PartialType } from '@nestjs/graphql';
import { IsUUID } from 'class-validator';
import { CreateRubricInput } from './create-rubric.input';

@InputType()
export class UpdateRubricInput extends PartialType(CreateRubricInput) {
  @IsUUID()
  @Field(() => String, {
    description:
      'Id automatically generated in integer format eg: 2ad0bc6e-7c63-43bd-ad90-feb291d985b4',
  })
  id: string;
}
