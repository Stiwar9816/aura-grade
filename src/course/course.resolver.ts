// NestJS
import { UseGuards } from '@nestjs/common';
import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
// Services
import { CourseService } from './course.service';
// Guards
import { JwtAuthGuard } from 'src/auth/guards';
// Entities
import { Course } from './entities/course.entity';
// Dto
import { CreateCourseInput, UpdateCourseInput } from './dto';
// Entities
import { User } from 'src/user/entities/user.entity';
// Decorators
import { CurrentUser } from 'src/auth/decorators';
// Enums
import { UserRoles } from 'src/auth/enums/user-roles.enum';

@Resolver(() => Course)
export class CourseResolver {
  constructor(private readonly courseService: CourseService) {}

  @Mutation(() => Course, { name: 'createCourse' })
  @UseGuards(JwtAuthGuard)
  createCourse(
    @Args('createCourseInput') createCourseInput: CreateCourseInput,
    @CurrentUser([UserRoles.Administrador, UserRoles.Docente]) user: User
  ) {
    return this.courseService.create(createCourseInput);
  }

  @Query(() => [Course], { name: 'courses' })
  @UseGuards(JwtAuthGuard)
  findAll(@CurrentUser([UserRoles.Administrador, UserRoles.Docente]) user: User) {
    return this.courseService.findAll(user);
  }

  @Query(() => Course, { name: 'course' })
  @UseGuards(JwtAuthGuard)
  findOne(
    @Args('id', { type: () => String }) id: string,
    @CurrentUser([UserRoles.Administrador, UserRoles.Docente]) user: User
  ) {
    return this.courseService.findOne(id);
  }

  @Mutation(() => Course, { name: 'updateCourse' })
  @UseGuards(JwtAuthGuard)
  updateCourse(
    @Args('updateCourseInput') updateCourseInput: UpdateCourseInput,
    @CurrentUser([UserRoles.Administrador, UserRoles.Docente]) user: User
  ) {
    return this.courseService.update(updateCourseInput.id, updateCourseInput);
  }

  @Mutation(() => Course, { name: 'removeCourse' })
  @UseGuards(JwtAuthGuard)
  removeCourse(
    @Args('id', { type: () => String }) id: string,
    @CurrentUser([UserRoles.Administrador, UserRoles.Docente]) user: User
  ) {
    return this.courseService.remove(id);
  }
}
