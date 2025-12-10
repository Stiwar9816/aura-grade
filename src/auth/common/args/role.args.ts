import { ArgsType, Field } from '@nestjs/graphql';
import { IsArray } from 'class-validator';
import { UserRoles } from 'src/auth/enums';

@ArgsType()
export class UserRolesArgs {
  @Field(() => [UserRoles], { nullable: true })
  @IsArray()
  roles: UserRoles[] = [];
}
