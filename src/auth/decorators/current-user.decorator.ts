// NestJS
import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
// GraphQL
import { GqlExecutionContext } from '@nestjs/graphql';
// Entities
import { User } from '../../user/entities/user.entity';
// Enums
import { UserRoles } from '../enums';

export const resolveCurrentUser = (role: UserRoles[] | undefined, ctx: ExecutionContext): User => {
  // Validation with HTTP request
  const getUserFromHttpContext = (context: ExecutionContext): User => {
    const request = context.switchToHttp().getRequest();
    return request.user;
  };
  // Validation with GraphQL request
  const getUserFromGraphqlContext = (context: ExecutionContext): User => {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req.user;
  };

  // Calls from the functions for validation
  const getUser = (context: ExecutionContext): User => {
    if (context.getType() === 'http') {
      return getUserFromHttpContext(context);
    } else {
      return getUserFromGraphqlContext(context);
    }
  };

  const user: User = getUser(ctx);

  //Validation of errors
  if (!user)
    throw new InternalServerErrorException(
      'No hay un usuario en la solicitud. Verifica que hayas usado AuthGuard.'
    );

  if (!role) return user;

  // Validate the user's role
  if (role && !role.includes(user.role)) {
    throw new ForbiddenException(
      `El usuario ${user.name} ${user.last_name} no tiene permisos suficientes.`
    );
  }

  return user;
};

//Validation of user with roles required for EndPoint
export const CurrentUser = createParamDecorator(resolveCurrentUser);
