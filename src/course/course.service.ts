import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
// TypeORM
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
// Dto
import { CreateCourseInput, UpdateCourseInput } from './dto';
// Entities
import { Course } from './entities/course.entity';
import { User } from 'src/user/entities/user.entity';
import { UserRoles } from 'src/auth/enums';

@Injectable()
export class CourseService {
  constructor(
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>
  ) {}

  async create(createCourseInput: CreateCourseInput, teacher: User): Promise<Course> {
    this.assertTeacher(teacher);
    const { userId: _, ...courseData } = createCourseInput;
    const course = this.courseRepository.create({
      ...courseData,
      user: { id: teacher.id } as User,
    });
    return await this.courseRepository.save(course);
  }

  async findAll(user: User): Promise<Course[]> {
    const where = user.isPlatformAdmin
      ? undefined
      : user.role === UserRoles.Docente
        ? { user: { id: user.id } }
        : user.role === UserRoles.Administrador
          ? { user: { institutionId: user.institutionId } }
          : { users: { id: user.id } };

    return await this.courseRepository.find({
      where,
      relations: ['users', 'user'],
    });
  }

  async findOne(id: string, actor: User): Promise<Course> {
    const course = await this.courseRepository.findOne({
      where: { id },
      relations: ['users', 'user'],
    });
    if (!course) throw new NotFoundException(`No se encontró el curso con identificador ${id}.`);

    const canAccess =
      actor.isPlatformAdmin ||
      (actor.role === UserRoles.Docente && course.user?.id === actor.id) ||
      (actor.role === UserRoles.Administrador &&
        course.user?.institutionId === actor.institutionId) ||
      (actor.role === UserRoles.Estudiante &&
        Boolean(course.users?.some((student) => student.id === actor.id)));
    if (!canAccess) throw new ForbiddenException('No puedes acceder a este curso.');

    return course;
  }

  async update(id: string, updateCourseInput: UpdateCourseInput, teacher: User): Promise<Course> {
    this.assertTeacher(teacher);
    const { studentsIds, ...toUpdate } = updateCourseInput;
    if (studentsIds !== undefined)
      throw new BadRequestException(
        'La matrícula de estudiantes debe gestionarse con assignCoursesToUser.'
      );

    await this.findOne(id, teacher);

    const course = await this.courseRepository.preload({
      id,
      ...toUpdate,
    });

    if (!course) throw new NotFoundException(`No se encontró el curso con identificador ${id}.`);

    return await this.courseRepository.save(course);
  }

  async remove(id: string, teacher: User): Promise<Course> {
    this.assertTeacher(teacher);
    const course = await this.findOne(id, teacher);
    await this.courseRepository.remove(course);
    return { ...course, id };
  }

  private assertTeacher(actor: User): void {
    if (actor.role !== UserRoles.Docente)
      throw new ForbiddenException('Solo un docente puede administrar el catálogo de cursos.');
  }
}
