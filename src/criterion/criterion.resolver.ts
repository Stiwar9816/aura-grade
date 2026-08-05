import { UseGuards } from '@nestjs/common';
// Graphql
import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
// Services
import { CriterionService } from './criterion.service';
// Entities
import { Criterion } from './entities/criterion.entity';
import { User } from 'src/user/entities/user.entity';
// Dto
import { CreateCriterionInput, UpdateCriterionInput } from './dto';
// Decorators
import { CurrentUser } from 'src/auth/decorators';
// Enums
import { UserRoles } from 'src/auth/enums';
// Guards
import { JwtAuthGuard } from 'src/auth/guards';

@Resolver(() => Criterion)
export class CriterionResolver {
  constructor(private readonly criterionService: CriterionService) {}

  @Mutation(() => Criterion, { name: 'createCriterion' })
  @UseGuards(JwtAuthGuard)
  createCriterion(
    @Args('createCriterionInput') createCriterionInput: CreateCriterionInput,
    @CurrentUser([UserRoles.Docente]) user: User
  ) {
    return this.criterionService.create(createCriterionInput, user);
  }

  @Query(() => [Criterion], { name: 'criteria' })
  @UseGuards(JwtAuthGuard)
  findAll(@CurrentUser([UserRoles.Administrador, UserRoles.Docente]) user: User) {
    return this.criterionService.findAll(user);
  }

  @Query(() => Criterion, { name: 'criterion' })
  @UseGuards(JwtAuthGuard)
  findOne(
    @Args('id', { type: () => String }) id: string,
    @CurrentUser([UserRoles.Administrador, UserRoles.Docente]) user: User
  ) {
    return this.criterionService.findOne(id, user);
  }

  @Mutation(() => Criterion, { name: 'updateCriterion' })
  @UseGuards(JwtAuthGuard)
  updateCriterion(
    @Args('updateCriterionInput') updateCriterionInput: UpdateCriterionInput,
    @CurrentUser([UserRoles.Docente]) user: User
  ) {
    return this.criterionService.update(updateCriterionInput.id, updateCriterionInput, user);
  }

  @Mutation(() => Criterion, { name: 'removeCriterion' })
  @UseGuards(JwtAuthGuard)
  removeCriterion(
    @Args('id', { type: () => String }) id: string,
    @CurrentUser([UserRoles.Docente]) user: User
  ) {
    return this.criterionService.remove(id, user);
  }
}
