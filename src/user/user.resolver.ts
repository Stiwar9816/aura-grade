// NestJS
import { ParseUUIDPipe, UseGuards } from '@nestjs/common';
// GraphQL
import {
  Args,
  Context,
  Float,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
// Decorators
import { CurrentUser } from '../auth/decorators';
// Guards
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
// Services
import { UserService } from './user.service';
// Dto
import {
  AssignCoursesInput,
  ChangePasswordInput,
  ReviewInstitutionUserInput,
  UpdateOwnProfileInput,
  UpdateUserInput,
} from './dto';
// Entities
import { User } from './entities/user.entity';
// Enums
import { UserRoles } from '../auth/enums';
import { NoAuthAuthGuard } from 'src/auth/guards';
import { Throttle } from '@nestjs/throttler';
import { DocumentType } from 'src/auth/enums/user-document-type.enum';
import { Submission } from 'src/submission/entities/submission.entity';
import { Assignment } from 'src/assignment/entities/assignment.entity';
import { Course } from 'src/course/entities/course.entity';
import { FileUpload, GraphQLUpload } from 'graphql-upload-ts';
import { UserImportService } from './import/user-import.service';
import { UserImportResult } from './import/user-import.types';

type UserFieldContext = {
  req?: {
    user?: User;
  };
};

@Resolver(() => User)
export class UserResolver {
  constructor(
    private readonly userService: UserService,
    private readonly userImportService: UserImportService
  ) {}

  @Mutation(() => UserImportResult, {
    name: 'importInstitutionUsers',
    description: 'Imports students and teachers into the current administrator institution.',
  })
  @Throttle({ short: { limit: 3, ttl: 15 * 60 * 1000 } })
  @UseGuards(JwtAuthGuard)
  importInstitutionUsers(
    @Args('file', { type: () => GraphQLUpload }) file: FileUpload,
    @CurrentUser([UserRoles.Administrador]) administrator: User
  ): Promise<UserImportResult> {
    return this.userImportService.import(file, administrator);
  }

  @Mutation(() => UserImportResult, {
    name: 'importPlatformAdministrators',
    description: 'Creates the initial administrator for existing institutions by tax ID.',
  })
  @Throttle({ short: { limit: 3, ttl: 15 * 60 * 1000 } })
  @UseGuards(JwtAuthGuard)
  importPlatformAdministrators(
    @Args('file', { type: () => GraphQLUpload }) file: FileUpload,
    @CurrentUser([UserRoles.Administrador]) platformAdministrator: User
  ): Promise<UserImportResult> {
    return this.userImportService.importPlatformAdministrators(file, platformAdministrator);
  }

  @Query(() => [User], {
    name: 'users',
    description: 'Find all users',
  })
  @UseGuards(JwtAuthGuard)
  findAll(@CurrentUser([UserRoles.Administrador, UserRoles.Docente]) user: User) {
    return this.userService.findAll(user);
  }

  @Query(() => [User], {
    name: 'pendingInstitutionUsers',
    description: 'Find pending users for the current administrator institution',
  })
  @UseGuards(JwtAuthGuard)
  findPendingInstitutionUsers(
    @CurrentUser([UserRoles.Administrador]) administrator: User
  ): Promise<User[]> {
    return this.userService.findPendingInstitutionUsers(administrator);
  }

  @Mutation(() => User, {
    name: 'reviewInstitutionUser',
    description: 'Approve or reject a pending user from the administrator institution',
  })
  @UseGuards(JwtAuthGuard)
  reviewInstitutionUser(
    @Args('input') input: ReviewInstitutionUserInput,
    @CurrentUser([UserRoles.Administrador]) administrator: User
  ): Promise<User> {
    return this.userService.reviewInstitutionUser(input, administrator);
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
    return this.userService.findOneForActor(id, user);
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
    return this.userService.findOneByEmailForActor(email, user);
  }

  @Mutation(() => User, {
    name: 'updateUser',
    description: 'Deprecated compatibility operation. Users may only update their own account.',
    deprecationReason: 'Use updateMyProfile for personal information.',
  })
  @UseGuards(JwtAuthGuard)
  updateUser(
    @Args('updateUserInput') updateUserInput: UpdateUserInput,
    @CurrentUser([UserRoles.Administrador, UserRoles.Docente, UserRoles.Estudiante]) user: User
  ) {
    return this.userService.update(updateUserInput.id, updateUserInput, user);
  }

  @Mutation(() => User, {
    name: 'updateMyProfile',
    description: 'Updates only the personal information of the authenticated user.',
  })
  @UseGuards(JwtAuthGuard)
  updateMyProfile(
    @Args('input') input: UpdateOwnProfileInput,
    @CurrentUser([UserRoles.Administrador, UserRoles.Docente, UserRoles.Estudiante]) user: User
  ): Promise<User> {
    return this.userService.updateOwnProfile(input, user);
  }

  @Mutation(() => User, {
    name: 'blockUser',
    description: 'Inactivate a user',
  })
  @UseGuards(JwtAuthGuard)
  blockUser(
    @Args('id', { type: () => String }, ParseUUIDPipe) id: string,
    @CurrentUser([UserRoles.Administrador]) administrator: User
  ): Promise<User> {
    return this.userService.block(id, administrator);
  }

  @Mutation(() => Boolean, {
    name: 'resetPassword',
    description: 'Reset password user',
  })
  @UseGuards(NoAuthAuthGuard)
  @Throttle({ short: { limit: 3, ttl: 15 * 60 * 1000 } })
  resetPassword(@Args('resetPassword', { type: () => String }) email: string): Promise<boolean> {
    return this.userService.resetPassword(email);
  }

  @Mutation(() => User, {
    name: 'resetPasswordAuth',
    description: 'Reset password user authenticed',
  })
  @UseGuards(JwtAuthGuard)
  resetPasswordAuth(
    @Args('input') { newPassword }: ChangePasswordInput,
    @CurrentUser() user: User
  ): Promise<User> {
    return this.userService.resetPasswordAuth(newPassword, user);
  }

  @Mutation(() => User, {
    name: 'assignCoursesToUser',
    description: 'Assign multiple courses to a user',
  })
  @UseGuards(JwtAuthGuard)
  assignCoursesToUser(
    @Args('assignCoursesInput') assignCoursesInput: AssignCoursesInput,
    @CurrentUser([UserRoles.Administrador, UserRoles.Docente]) actor: User
  ) {
    return this.userService.assignCourses(assignCoursesInput, actor);
  }

  @ResolveField(() => String, { nullable: true })
  email(@Parent() subject: User, @Context() context: UserFieldContext): string | null {
    return this.canReadContact(context.req?.user, subject) ? subject.email : null;
  }

  @ResolveField(() => Float, { nullable: true })
  phone(@Parent() subject: User, @Context() context: UserFieldContext): number | null {
    return this.canReadContact(context.req?.user, subject) ? subject.phone : null;
  }

  @ResolveField(() => DocumentType, { nullable: true })
  document_type(
    @Parent() subject: User,
    @Context() context: UserFieldContext
  ): DocumentType | null {
    return this.canReadIdentity(context.req?.user, subject) ? subject.document_type : null;
  }

  @ResolveField(() => Float, { nullable: true })
  document_num(@Parent() subject: User, @Context() context: UserFieldContext): number | null {
    return this.canReadIdentity(context.req?.user, subject) ? subject.document_num : null;
  }

  @ResolveField(() => [Submission], { nullable: true })
  submissions(@Parent() subject: User, @Context() context: UserFieldContext): Submission[] {
    const actor = context.req?.user;
    if (!this.sameInstitution(actor, subject)) return [];
    if (actor.isPlatformAdmin || actor.role === UserRoles.Administrador || actor.id === subject.id)
      return subject.submissions ?? [];
    if (actor.role !== UserRoles.Docente || subject.role !== UserRoles.Estudiante) return [];

    return (subject.submissions ?? []).filter(
      (submission) => submission.assignment?.user?.id === actor.id
    );
  }

  @ResolveField(() => [Assignment], { nullable: true })
  assignments(@Parent() subject: User, @Context() context: UserFieldContext): Assignment[] {
    const actor = context.req?.user;
    if (!this.sameInstitution(actor, subject)) return [];
    if (actor.isPlatformAdmin || actor.role === UserRoles.Administrador || actor.id === subject.id)
      return subject.assignments ?? [];
    return [];
  }

  @ResolveField(() => [Course], { nullable: true })
  courses(@Parent() subject: User, @Context() context: UserFieldContext): Course[] {
    const actor = context.req?.user;
    if (!this.sameInstitution(actor, subject)) return [];
    if (actor.isPlatformAdmin || actor.role === UserRoles.Administrador || actor.id === subject.id)
      return subject.courses ?? [];
    if (actor.role === UserRoles.Docente && subject.role === UserRoles.Estudiante)
      return subject.courses ?? [];
    return [];
  }

  private canReadContact(actor: User | undefined, subject: User): boolean {
    if (!this.sameInstitution(actor, subject)) return false;
    return (
      actor.isPlatformAdmin ||
      actor.role === UserRoles.Administrador ||
      actor.id === subject.id ||
      (actor.role === UserRoles.Docente && subject.role === UserRoles.Estudiante)
    );
  }

  private canReadIdentity(actor: User | undefined, subject: User): boolean {
    if (!this.sameInstitution(actor, subject)) return false;
    return (
      actor.isPlatformAdmin || actor.role === UserRoles.Administrador || actor.id === subject.id
    );
  }

  private sameInstitution(actor: User | undefined, subject: User): actor is User {
    return Boolean(
      actor && (actor.isPlatformAdmin || actor.institutionId === subject.institutionId)
    );
  }
}
