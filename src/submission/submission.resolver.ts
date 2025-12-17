// Common
import { ParseUUIDPipe } from '@nestjs/common';
// Graphql
import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
// Services
import { SubmissionService } from './submission.service';
// Entities
import { Submission } from './entities/submission.entity';
// DTOs
import { CreateSubmissionInput, UpdateSubmissionInput } from './dto';

@Resolver(() => Submission)
export class SubmissionResolver {
  constructor(private readonly submissionService: SubmissionService) {}

  @Mutation(() => Submission, { name: 'createSubmission' })
  createSubmission(
    @Args('createSubmissionInput') createSubmissionInput: CreateSubmissionInput
  ): Promise<Submission> {
    return this.submissionService.create(createSubmissionInput);
  }

  @Query(() => [Submission], { name: 'submissions' })
  findAll(): Promise<Submission[]> {
    return this.submissionService.findAll();
  }

  @Query(() => Submission, { name: 'submission' })
  findOne(@Args('id', { type: () => ID }, ParseUUIDPipe) id: string): Promise<Submission> {
    return this.submissionService.findOne(id);
  }

  @Mutation(() => Submission, { name: 'updateSubmission' })
  updateSubmission(
    @Args('updateSubmissionInput') updateSubmissionInput: UpdateSubmissionInput
  ): Promise<Submission> {
    return this.submissionService.update(updateSubmissionInput.id, updateSubmissionInput);
  }

  @Mutation(() => Submission, { name: 'removeSubmission' })
  removeSubmission(@Args('id', { type: () => ID }, ParseUUIDPipe) id: string): Promise<Submission> {
    return this.submissionService.remove(id);
  }
}
