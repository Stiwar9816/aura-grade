import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class UserImportRowResult {
  @Field(() => Int)
  row: number;

  @Field(() => String, { nullable: true })
  email?: string;

  @Field(() => Boolean)
  imported: boolean;

  @Field(() => String)
  message: string;
}

@ObjectType()
export class UserImportResult {
  @Field(() => Int)
  total: number;

  @Field(() => Int)
  imported: number;

  @Field(() => Int)
  rejected: number;

  @Field(() => [UserImportRowResult])
  rows: UserImportRowResult[];
}
