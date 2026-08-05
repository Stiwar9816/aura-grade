import { InputType, PartialType, PickType } from '@nestjs/graphql';
import { CreateUserInput } from './create-user.input';

@InputType()
export class UpdateOwnProfileInput extends PartialType(
  PickType(CreateUserInput, [
    'name',
    'last_name',
    'document_type',
    'document_num',
    'phone',
    'email',
  ] as const)
) {}
