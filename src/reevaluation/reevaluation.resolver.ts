import { ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from 'src/auth/decorators';
import { UserRoles } from 'src/auth/enums';
import { JwtAuthGuard } from 'src/auth/guards';
import { User } from 'src/user/entities/user.entity';
import { CreateReEvaluationRequestInput, ResolveReEvaluationRequestInput } from './dto';
import { ReEvaluationRequest } from './entities/reevaluation-request.entity';
import { ReEvaluationService } from './reevaluation.service';

@Resolver(() => ReEvaluationRequest)
export class ReEvaluationResolver {
  constructor(private readonly reEvaluationService: ReEvaluationService) {}

  @Mutation(() => ReEvaluationRequest, { name: 'createReEvaluationRequest' })
  @UseGuards(JwtAuthGuard)
  createReEvaluationRequest(
    @Args('createReEvaluationRequestInput')
    createReEvaluationRequestInput: CreateReEvaluationRequestInput,
    @CurrentUser([UserRoles.Estudiante]) user: User
  ): Promise<ReEvaluationRequest> {
    return this.reEvaluationService.create(createReEvaluationRequestInput, user);
  }

  @Mutation(() => ReEvaluationRequest, { name: 'resolveReEvaluationRequest' })
  @UseGuards(JwtAuthGuard)
  resolveReEvaluationRequest(
    @Args('resolveReEvaluationRequestInput')
    resolveReEvaluationRequestInput: ResolveReEvaluationRequestInput,
    @CurrentUser([UserRoles.Administrador, UserRoles.Docente]) user: User
  ): Promise<ReEvaluationRequest> {
    return this.reEvaluationService.resolve(resolveReEvaluationRequestInput, user);
  }

  @Query(() => [ReEvaluationRequest], { name: 'reEvaluationRequests' })
  @UseGuards(JwtAuthGuard)
  findAll(
    @CurrentUser([UserRoles.Administrador, UserRoles.Docente, UserRoles.Estudiante]) user: User
  ): Promise<ReEvaluationRequest[]> {
    return this.reEvaluationService.findAll(user);
  }

  @Query(() => ReEvaluationRequest, { name: 'reEvaluationRequest' })
  @UseGuards(JwtAuthGuard)
  findOne(
    @Args('id', { type: () => ID }, ParseUUIDPipe) id: string,
    @CurrentUser([UserRoles.Administrador, UserRoles.Docente, UserRoles.Estudiante]) user: User
  ): Promise<ReEvaluationRequest> {
    return this.reEvaluationService.findOne(id, user);
  }
}
