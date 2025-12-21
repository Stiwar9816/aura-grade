// Pipes
import { ParseUUIDPipe, UseGuards } from '@nestjs/common';
// GraphQL
import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
// Services
import { EvaluationService } from './evaluation.service';
// Entities
import { Evaluation } from './entities/evaluation.entity';
import { User } from 'src/user/entities/user.entity';
// DTOs
import { CreateEvaluationInput, UpdateEvaluationInput } from './dto';
// Guards
import { JwtAuthGuard } from 'src/auth/guards';
// Decorators
import { CurrentUser } from 'src/auth/decorators';
// Enums
import { UserRoles } from 'src/auth/enums';

@Resolver(() => Evaluation)
export class EvaluationResolver {
  constructor(private readonly evaluationService: EvaluationService) {}

  @Mutation(() => Evaluation, { name: 'createEvaluation' })
  @UseGuards(JwtAuthGuard)
  createEvaluation(
    @Args('createEvaluationInput') createEvaluationInput: CreateEvaluationInput,
    @CurrentUser([UserRoles.Administrador, UserRoles.Docente]) user: User
  ): Promise<Evaluation> {
    return this.evaluationService.create(createEvaluationInput);
  }

  @Query(() => [Evaluation], { name: 'evaluations' })
  @UseGuards(JwtAuthGuard)
  findAll(
    @CurrentUser([UserRoles.Administrador, UserRoles.Docente, UserRoles.Estudiante]) user: User
  ): Promise<Evaluation[]> {
    return this.evaluationService.findAll();
  }

  @Query(() => Evaluation, { name: 'Evaluation' })
  @UseGuards(JwtAuthGuard)
  findOne(
    @Args('id', { type: () => ID }, ParseUUIDPipe) id: string,
    @CurrentUser([UserRoles.Administrador, UserRoles.Docente, UserRoles.Estudiante]) user: User
  ): Promise<Evaluation> {
    return this.evaluationService.findOne(id);
  }

  @Query(() => Evaluation, { name: 'evaluationBySubmission' })
  @UseGuards(JwtAuthGuard)
  async findBySubmission(
    @Args('submissionId', { type: () => ID }, ParseUUIDPipe) submissionId: string,
    @CurrentUser([UserRoles.Administrador, UserRoles.Docente, UserRoles.Estudiante]) user: User
  ): Promise<Evaluation> {
    return this.evaluationService.findBySubmission(submissionId);
  }

  @Mutation(() => Evaluation, { name: 'updateEvaluation' })
  @UseGuards(JwtAuthGuard)
  updateEvaluation(
    @Args('updateEvaluationInput') updateEvaluationInput: UpdateEvaluationInput,
    @CurrentUser([UserRoles.Administrador, UserRoles.Docente]) user: User
  ): Promise<Evaluation> {
    return this.evaluationService.update(updateEvaluationInput.id, updateEvaluationInput);
  }

  @Mutation(() => Evaluation, { name: 'publishEvaluation' })
  @UseGuards(JwtAuthGuard)
  publishEvaluation(
    @Args('id', { type: () => ID }, ParseUUIDPipe) id: string,
    @Args('updateEvaluationInput', { nullable: true })
    updateEvaluationInput: UpdateEvaluationInput,
    @CurrentUser([UserRoles.Administrador, UserRoles.Docente]) user: User
  ): Promise<Evaluation> {
    return this.evaluationService.publish(id, updateEvaluationInput);
  }

  @Mutation(() => Boolean, { name: 'removeEvaluation' })
  @UseGuards(JwtAuthGuard)
  removeEvaluation(
    @Args('id', { type: () => ID }, ParseUUIDPipe) id: string,
    @CurrentUser([UserRoles.Administrador, UserRoles.Docente]) user: User
  ): Promise<boolean> {
    return this.evaluationService.remove(id);
  }
}
