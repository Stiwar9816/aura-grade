import { UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
// Graphql
import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
// Services
import { RubricService } from './rubric.service';
// Decorators
import { CurrentUser } from 'src/auth/decorators';
// Guards
import { JwtAuthGuard } from 'src/auth/guards';
// Entities
import { Rubric } from './entities/rubric.entity';
import { User } from 'src/user/entities/user.entity';
// Dto
import {
  CreateRubricInput,
  GenerateRubricInput,
  SaveRubricDraftInput,
  UpdateRubricInput,
} from './dto';
// Enums
import { UserRoles } from 'src/auth/enums/user-roles.enum';
import { GeneratedRubricType } from './types/generated-rubric.type';

@Resolver(() => Rubric)
export class RubricResolver {
  constructor(private readonly rubricService: RubricService) {}

  @Mutation(() => Rubric, { name: 'createRubric' })
  @UseGuards(JwtAuthGuard)
  createRubric(
    @Args('createRubricInput') createRubricInput: CreateRubricInput,
    @CurrentUser([UserRoles.Docente]) user: User
  ) {
    return this.rubricService.create(createRubricInput, user);
  }

  @Mutation(() => GeneratedRubricType, { name: 'generateRubricDraft' })
  @UseGuards(JwtAuthGuard)
  @Throttle({ short: { limit: 5, ttl: 60 * 1000 } })
  generateRubricDraft(
    @Args('input') input: GenerateRubricInput,
    @CurrentUser([UserRoles.Docente]) user: User
  ) {
    return this.rubricService.generateDraft(input, user);
  }

  @Mutation(() => Rubric, { name: 'saveRubricDraft' })
  @UseGuards(JwtAuthGuard)
  saveRubricDraft(
    @Args('input') input: SaveRubricDraftInput,
    @CurrentUser([UserRoles.Docente]) user: User
  ) {
    return this.rubricService.saveDraft(input, user);
  }

  @Query(() => [Rubric], { name: 'rubrics' })
  @UseGuards(JwtAuthGuard)
  findAll(@CurrentUser([UserRoles.Administrador, UserRoles.Docente]) user: User) {
    return this.rubricService.findAll(user);
  }

  @Query(() => Rubric, { name: 'rubric' })
  @UseGuards(JwtAuthGuard)
  findOne(
    @Args('id', { type: () => String }) id: string,
    @CurrentUser([UserRoles.Administrador, UserRoles.Docente]) user: User
  ) {
    return this.rubricService.findOne(id, user);
  }

  @Mutation(() => Rubric, { name: 'updateRubric' })
  @UseGuards(JwtAuthGuard)
  updateRubric(
    @Args('updateRubricInput') updateRubricInput: UpdateRubricInput,
    @CurrentUser([UserRoles.Docente]) user: User
  ) {
    return this.rubricService.update(updateRubricInput.id, updateRubricInput, user);
  }

  @Mutation(() => Rubric, { name: 'removeRubric' })
  @UseGuards(JwtAuthGuard)
  removeRubric(
    @Args('id', { type: () => String }) id: string,
    @CurrentUser([UserRoles.Docente]) user: User
  ) {
    return this.rubricService.remove(id, user);
  }
}
