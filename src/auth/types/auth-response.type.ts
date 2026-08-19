// GraphQL
import { Field, ObjectType } from '@nestjs/graphql';
// Entities
import { User } from 'src/user/entities/user.entity';

@ObjectType({
  description: `
        Scheme of how to expect the response from the Auth module of users of [ Signin & Signup ] 
        mutations and [ revalidateToken ] queries 
        { 
            sessionToken,
            User[] 
        }
    `,
})
export class AuthResponde {
  @Field(() => String)
  sessionToken: string;

  @Field(() => User)
  user: User;
}
