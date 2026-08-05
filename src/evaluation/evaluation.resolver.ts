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
import { UpdateEvaluationInput } from './dto';
// Guards
import { JwtAuthGuard } from 'src/auth/guards';
// Decorators
import { CurrentUser } from 'src/auth/decorators';
// Enums
import { UserRoles } from 'src/auth/enums';

@Resolver(() => Evaluation)
export class EvaluationResolver {
  constructor(private readonly evaluationService: EvaluationService) {}

  @Query(() => [Evaluation], { name: 'evaluations' })
  @UseGuards(JwtAuthGuard)
  findAll(
    @CurrentUser([UserRoles.Administrador, UserRoles.Docente, UserRoles.Estudiante]) user: User
  ): Promise<Evaluation[]> {
    return this.evaluationService.findAll(user);
  }

  @Query(() => Evaluation, { name: 'Evaluation' })
  @UseGuards(JwtAuthGuard)
  findOne(
    @Args('id', { type: () => ID }, ParseUUIDPipe) id: string,
    @CurrentUser([UserRoles.Administrador, UserRoles.Docente, UserRoles.Estudiante]) user: User
  ): Promise<Evaluation> {
    return this.evaluationService.findOne(id, user);
  }

  @Query(() => Evaluation, { name: 'evaluationBySubmission' })
  @UseGuards(JwtAuthGuard)
  async findBySubmission(
    @Args('submissionId', { type: () => ID }, ParseUUIDPipe) submissionId: string,
    @CurrentUser([UserRoles.Administrador, UserRoles.Docente, UserRoles.Estudiante]) user: User
  ): Promise<Evaluation> {
    return this.evaluationService.findBySubmission(submissionId, user);
  }

  @Mutation(() => Evaluation, { name: 'publishEvaluation' })
  @UseGuards(JwtAuthGuard)
  publishEvaluation(
    @Args('id', { type: () => ID }, ParseUUIDPipe) id: string,
    @Args('updateEvaluationInput', { nullable: true })
    updateEvaluationInput: UpdateEvaluationInput,
    @CurrentUser([UserRoles.Docente]) user: User
  ): Promise<Evaluation> {
    return this.evaluationService.publish(id, updateEvaluationInput, user);
  }
}
