// Pipes
import { ParseUUIDPipe } from '@nestjs/common';
// GraphQL
import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
// Services
import { EvaluationService } from './evaluation.service';
// Entities
import { Evaluation } from './entities/evaluation.entity';
// DTOs
import { CreateEvaluationInput, UpdateEvaluationInput } from './dto';

@Resolver(() => Evaluation)
export class EvaluationResolver {
  constructor(private readonly evaluationService: EvaluationService) {}

  @Mutation(() => Evaluation, { name: 'createEvaluation' })
  createEvaluation(
    @Args('createEvaluationInput') createEvaluationInput: CreateEvaluationInput
  ): Promise<Evaluation> {
    return this.evaluationService.create(createEvaluationInput);
  }

  @Query(() => [Evaluation], { name: 'evaluations' })
  findAll(): Promise<Evaluation[]> {
    return this.evaluationService.findAll();
  }

  @Query(() => Evaluation, { name: 'Evaluation' })
  findOne(@Args('id', { type: () => ID }, ParseUUIDPipe) id: string): Promise<Evaluation> {
    return this.evaluationService.findOne(id);
  }

  @Query(() => Evaluation, { name: 'evaluationBySubmission' })
  async findBySubmission(
    @Args('submissionId', { type: () => ID }, ParseUUIDPipe) submissionId: string
  ): Promise<Evaluation> {
    return this.evaluationService.findBySubmission(submissionId);
  }

  @Mutation(() => Evaluation, { name: 'updateEvaluation' })
  updateEvaluation(
    @Args('updateEvaluationInput') updateEvaluationInput: UpdateEvaluationInput
  ): Promise<Evaluation> {
    return this.evaluationService.update(updateEvaluationInput.id, updateEvaluationInput);
  }

  @Mutation(() => Boolean, { name: 'removeEvaluation' })
  removeEvaluation(@Args('id', { type: () => ID }, ParseUUIDPipe) id: string): Promise<boolean> {
    return this.evaluationService.remove(id);
  }
}
