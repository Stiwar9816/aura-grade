import { ParseUUIDPipe } from '@nestjs/common';
// graphQL
import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
// Services
import { AssignmentService } from './assignment.service';
// Entities
import { Assignment } from './entities/assignment.entity';
// DTO
import { CreateAssignmentInput, UpdateAssignmentInput } from './dto';

@Resolver(() => Assignment)
export class AssignmentResolver {
  constructor(private readonly assignmentService: AssignmentService) {}

  @Mutation(() => Assignment, { name: 'createAssignment' })
  createAssignment(@Args('createAssignmentInput') createAssignmentInput: CreateAssignmentInput) {
    return this.assignmentService.create(createAssignmentInput);
  }

  @Query(() => [Assignment], { name: 'assignments' })
  findAll() {
    return this.assignmentService.findAll();
  }

  @Query(() => Assignment, { name: 'assignment' })
  findOne(@Args('id', { type: () => ID }, ParseUUIDPipe) id: string) {
    return this.assignmentService.findOne(id);
  }

  @Mutation(() => Assignment, { name: 'updateAssignment' })
  updateAssignment(@Args('updateAssignmentInput') updateAssignmentInput: UpdateAssignmentInput) {
    return this.assignmentService.update(updateAssignmentInput.id, updateAssignmentInput);
  }

  @Mutation(() => Assignment, { name: 'removeAssignment' })
  removeAssignment(@Args('id', { type: () => ID }, ParseUUIDPipe) id: string) {
    return this.assignmentService.remove(id);
  }
}
