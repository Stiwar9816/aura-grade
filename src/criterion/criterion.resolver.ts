// Graphql
import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
// Services
import { CriterionService } from './criterion.service';
// Entities
import { Criterion } from './entities/criterion.entity';
// Dto
import { CreateCriterionInput, UpdateCriterionInput } from './dto';

@Resolver(() => Criterion)
export class CriterionResolver {
  constructor(private readonly criterionService: CriterionService) {}

  @Mutation(() => Criterion, { name: 'createCriterion' })
  createCriterion(@Args('createCriterionInput') createCriterionInput: CreateCriterionInput) {
    return this.criterionService.create(createCriterionInput);
  }

  @Query(() => [Criterion], { name: 'criteria' })
  findAll() {
    return this.criterionService.findAll();
  }

  @Query(() => Criterion, { name: 'criterion' })
  findOne(@Args('id', { type: () => String }) id: string) {
    return this.criterionService.findOne(id);
  }

  @Mutation(() => Criterion, { name: 'updateCriterion' })
  updateCriterion(@Args('updateCriterionInput') updateCriterionInput: UpdateCriterionInput) {
    return this.criterionService.update(updateCriterionInput.id, updateCriterionInput);
  }

  @Mutation(() => Criterion, { name: 'removeCriterion' })
  removeCriterion(@Args('id', { type: () => String }) id: string) {
    return this.criterionService.remove(id);
  }
}
