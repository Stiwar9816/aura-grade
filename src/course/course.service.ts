import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
// TypeORM
import { Not, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
// Dto
import { CreateCourseInput, UpdateCourseInput } from './dto';
import { SGA_GROUP_CODE_MESSAGE, SGA_GROUP_CODE_PATTERN, normalizeCourseCode } from './course-code';
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
    const code = normalizeCourseCode(courseData.code_course);
    this.assertSgaGroupCode(code);
    await this.assertUniqueSgaCourse(teacher.id, code, courseData.sga_subject_code);
    const course = this.courseRepository.create({
      ...courseData,
      code_course: code,
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

    const current = await this.findOne(id, teacher);

    // A legacy code may stay as it is; any code the teacher writes now must follow the SGA format.
    const code =
      toUpdate.code_course !== undefined
        ? normalizeCourseCode(toUpdate.code_course)
        : current.code_course;
    const subject = toUpdate.sga_subject_code ?? current.sga_subject_code;
    if (code !== current.code_course) this.assertSgaGroupCode(code);
    if (subject && (code !== current.code_course || subject !== current.sga_subject_code))
      await this.assertUniqueSgaCourse(teacher.id, code, subject, id);

    const course = await this.courseRepository.preload({
      id,
      ...toUpdate,
      ...(toUpdate.code_course !== undefined && { code_course: code }),
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

  private assertSgaGroupCode(code: string): void {
    if (!SGA_GROUP_CODE_PATTERN.test(code)) throw new BadRequestException(SGA_GROUP_CODE_MESSAGE);
  }

  /** The same teacher cannot have two courses for one subject of one group. */
  private async assertUniqueSgaCourse(
    teacherId: string,
    code: string,
    subject: string,
    exceptCourseId?: string
  ): Promise<void> {
    const duplicated = await this.courseRepository.existsBy({
      user: { id: teacherId },
      code_course: code,
      sga_subject_code: subject,
      ...(exceptCourseId && { id: Not(exceptCourseId) }),
    });
    if (duplicated)
      throw new BadRequestException('Ya tienes un curso con ese código de grupo y de materia.');
  }

  private assertTeacher(actor: User): void {
    if (actor.role !== UserRoles.Docente)
      throw new ForbiddenException('Solo un docente puede administrar el catálogo de cursos.');
  }
}
