// NestJS
import { ParseUUIDPipe, UseGuards } from '@nestjs/common';
// GraphQL
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
// Decorators
import { CurrentUser } from '../auth/decorators';
// Guards
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
// Services
import { UserService } from './user.service';
// Dto
import { UpdateUserInput } from './dto';
// Entities
import { User } from './entities/user.entity';
// Enums
import { UserRoles } from '../auth/enums';
import { NoAuthAuthGuard } from 'src/auth/guards';

@Resolver(() => User)
export class UserResolver {
  constructor(private readonly userService: UserService) {}

  @Query(() => [User], {
    name: 'users',
    description: 'Find all users',
  })
  @UseGuards(JwtAuthGuard)
  findAll(@CurrentUser([UserRoles.Administrador, UserRoles.Docente]) user: User) {
    return this.userService.findAll(user);
  }

  @Query(() => User, {
    name: 'userByID',
    description: 'Search for a user by a unique ID',
  })
  @UseGuards(JwtAuthGuard)
  findOne(
    @Args('id', { type: () => String }, ParseUUIDPipe) id: string,
    @CurrentUser([UserRoles.Administrador, UserRoles.Docente]) user: User
  ): Promise<User> {
    return this.userService.findOneById(id);
  }

  @Query(() => User, {
    name: 'userByEmail',
    description: 'Search for a user by a unique Email',
  })
  @UseGuards(JwtAuthGuard)
  findOneByEmail(
    @Args('email', { type: () => String }) email: string,
    @CurrentUser([UserRoles.Administrador, UserRoles.Docente]) user: User
  ): Promise<User> {
    return this.userService.findOneByEmail(email);
  }

  @Mutation(() => User, {
    name: 'updateUser',
    description: 'Updates the data of a user by a unique ID',
  })
  @UseGuards(JwtAuthGuard)
  updateUser(
    @Args('updateUserInput') updateUserInput: UpdateUserInput,
    @CurrentUser([UserRoles.Administrador, UserRoles.Docente]) user: User
  ) {
    return this.userService.update(updateUserInput.id, updateUserInput);
  }

  @Mutation(() => User, {
    name: 'blockUser',
    description: 'Inactivate a user',
  })
  @UseGuards(JwtAuthGuard)
  blockUser(
    @Args('id', { type: () => String }, ParseUUIDPipe) id: string,
    @CurrentUser([UserRoles.Administrador, UserRoles.Docente]) user: User
  ): Promise<User> {
    return this.userService.block(id);
  }

  @Mutation(() => User, {
    name: 'resetPassword',
    description: 'Reset password user',
  })
  @UseGuards(NoAuthAuthGuard)
  resetPassword(@Args('resetPassword', { type: () => String }) email: string): Promise<User> {
    return this.userService.resetPassword(email);
  }

  @Mutation(() => User, {
    name: 'resetPasswordAuth',
    description: 'Reset password user authenticed',
  })
  @UseGuards(JwtAuthGuard)
  resetPasswordAuth(
    @Args('newPassword', { type: () => String }) password: string,
    @CurrentUser([UserRoles.Administrador, UserRoles.Docente]) user: User
  ): Promise<User> {
    return this.userService.resetPasswordAuth(password, user);
  }
}
