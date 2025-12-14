import { UseGuards } from '@nestjs/common';
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
import { CreateRubricInput, UpdateRubricInput } from './dto';
// Enums
import { UserRoles } from 'src/auth/enums/user-roles.enum';

@Resolver(() => Rubric)
export class RubricResolver {
  constructor(private readonly rubricService: RubricService) {}

  @Mutation(() => Rubric, { name: 'createRubric' })
  @UseGuards(JwtAuthGuard)
  createRubric(
    @Args('createRubricInput') createRubricInput: CreateRubricInput,
    @CurrentUser([UserRoles.Administrador, UserRoles.Docente]) user: User
  ) {
    return this.rubricService.create(createRubricInput);
  }

  @Query(() => [Rubric], { name: 'rubrics' })
  @UseGuards(JwtAuthGuard)
  findAll(@CurrentUser([UserRoles.Administrador, UserRoles.Docente]) user: User) {
    return this.rubricService.findAll();
  }

  @Query(() => Rubric, { name: 'rubric' })
  @UseGuards(JwtAuthGuard)
  findOne(
    @Args('id', { type: () => String }) id: string,
    @CurrentUser([UserRoles.Administrador, UserRoles.Docente]) user: User
  ) {
    return this.rubricService.findOne(id);
  }

  @Mutation(() => Rubric, { name: 'updateRubric' })
  @UseGuards(JwtAuthGuard)
  updateRubric(
    @Args('updateRubricInput') updateRubricInput: UpdateRubricInput,
    @CurrentUser([UserRoles.Administrador, UserRoles.Docente]) user: User
  ) {
    return this.rubricService.update(updateRubricInput.id, updateRubricInput);
  }

  @Mutation(() => Rubric, { name: 'removeRubric' })
  @UseGuards(JwtAuthGuard)
  removeRubric(
    @Args('id', { type: () => String }) id: string,
    @CurrentUser([UserRoles.Administrador, UserRoles.Docente]) user: User
  ) {
    return this.rubricService.remove(id);
  }
}
