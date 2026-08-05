// Common
import { ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
// Graphql
import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
// Services
import { SubmissionService } from './submission.service';
// Entities
import { Submission } from './entities/submission.entity';
// DTOs
import { CreateSubmissionInput } from './dto';
// Graphql
import { FileUpload, GraphQLUpload } from 'graphql-upload-ts';
// Guards
import { JwtAuthGuard } from 'src/auth/guards';
// Decorators
import { CurrentUser } from 'src/auth/decorators';
// Enums
import { UserRoles } from 'src/auth/enums';
// Entities
import { User } from 'src/user/entities/user.entity';

@Resolver(() => Submission)
export class SubmissionResolver {
  constructor(private readonly submissionService: SubmissionService) {}

  @Mutation(() => Submission, { name: 'createSubmission' })
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  @UseGuards(JwtAuthGuard)
  async createSubmission(
    @Args('createSubmissionInput') createSubmissionInput: CreateSubmissionInput,
    @Args('file', { type: () => GraphQLUpload }) file: FileUpload,
    @CurrentUser([UserRoles.Estudiante]) user: User
  ): Promise<Submission> {
    return this.submissionService.create(file, createSubmissionInput, user);
  }

  @Query(() => [Submission], { name: 'submissions' })
  @UseGuards(JwtAuthGuard)
  findAll(
    @CurrentUser([UserRoles.Administrador, UserRoles.Docente, UserRoles.Estudiante]) user: User
  ): Promise<Submission[]> {
    return this.submissionService.findAll(user);
  }

  @Query(() => Submission, { name: 'submission' })
  @UseGuards(JwtAuthGuard)
  findOne(
    @Args('id', { type: () => ID }, ParseUUIDPipe) id: string,
    @CurrentUser([UserRoles.Administrador, UserRoles.Docente, UserRoles.Estudiante]) user: User
  ): Promise<Submission> {
    return this.submissionService.findOne(id, user);
  }
}
