import { ParseUUIDPipe, UseGuards } from '@nestjs/common';
// graphQL
import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
// Services
import { AssignmentService } from './assignment.service';
// Entities
import { Assignment } from './entities/assignment.entity';
import { User } from 'src/user/entities/user.entity';
// DTO
import { CreateAssignmentInput, UpdateAssignmentInput } from './dto';
// Guards
import { JwtAuthGuard } from 'src/auth/guards';
// Enums
import { UserRoles } from 'src/auth/enums';
// Decorators
import { CurrentUser } from 'src/auth/decorators';

@Resolver(() => Assignment)
export class AssignmentResolver {
  constructor(private readonly assignmentService: AssignmentService) {}

  @Mutation(() => Assignment, { name: 'createAssignment' })
  @UseGuards(JwtAuthGuard)
  createAssignment(
    @Args('createAssignmentInput') createAssignmentInput: CreateAssignmentInput,
    @CurrentUser([UserRoles.Docente]) user: User
  ) {
    return this.assignmentService.create(createAssignmentInput, user);
  }

  @Query(() => [Assignment], { name: 'assignments' })
  @UseGuards(JwtAuthGuard)
  findAll(
    @CurrentUser([UserRoles.Administrador, UserRoles.Docente, UserRoles.Estudiante]) user: User
  ) {
    return this.assignmentService.findAll(user);
  }

  @Query(() => Assignment, { name: 'assignment' })
  @UseGuards(JwtAuthGuard)
  findOne(
    @Args('id', { type: () => ID }, ParseUUIDPipe) id: string,
    @CurrentUser([UserRoles.Administrador, UserRoles.Docente, UserRoles.Estudiante]) user: User
  ) {
    return this.assignmentService.findOne(id, user);
  }

  @Mutation(() => Assignment, { name: 'updateAssignment' })
  @UseGuards(JwtAuthGuard)
  updateAssignment(
    @Args('updateAssignmentInput') updateAssignmentInput: UpdateAssignmentInput,
    @CurrentUser([UserRoles.Docente]) user: User
  ) {
    return this.assignmentService.update(updateAssignmentInput.id, updateAssignmentInput, user);
  }

  @Mutation(() => Assignment, { name: 'removeAssignment' })
  @UseGuards(JwtAuthGuard)
  removeAssignment(
    @Args('id', { type: () => ID }, ParseUUIDPipe) id: string,
    @CurrentUser([UserRoles.Docente]) user: User
  ) {
    return this.assignmentService.remove(id, user);
  }
}
