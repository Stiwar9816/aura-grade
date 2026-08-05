// NestJS
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
// DTO
import { CreateAssignmentInput, UpdateAssignmentInput } from './dto';
// TypeORM
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
// Entities
import { Assignment } from './entities/assignment.entity';
import { Course } from 'src/course/entities/course.entity';
import { Rubric } from 'src/rubric/entities/rubric.entity';
import { User } from 'src/user/entities/user.entity';
import { UserRoles } from 'src/auth/enums';

const ASSIGNMENT_RELATIONS = [
  'rubric',
  'rubric.criteria',
  'rubric.user',
  'user',
  'course',
  'course.user',
  'course.users',
  'submissions',
  'submissions.student',
  'submissions.evaluation',
];

@Injectable()
export class AssignmentService {
  constructor(
    @InjectRepository(Assignment)
    private readonly assignmentRepository: Repository<Assignment>,
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(Rubric)
    private readonly rubricRepository: Repository<Rubric>
  ) {}

  async create(input: CreateAssignmentInput, teacher: User): Promise<Assignment> {
    this.assertTeacher(teacher);
    const { courseId, rubricId, ...assignmentData } = input;
    const [course, rubric] = await Promise.all([
      this.findOwnedCourse(courseId, teacher),
      this.findOwnedRubric(rubricId, teacher),
    ]);

    const assignment = this.assignmentRepository.create({
      ...assignmentData,
      rubric,
      user: teacher,
      course,
    });

    const savedAssignment = await this.assignmentRepository.save(assignment);
    return this.findOne(savedAssignment.id, teacher);
  }

  async findAll(actor: User): Promise<Assignment[]> {
    const where = actor.isPlatformAdmin
      ? { isActive: true }
      : actor.role === UserRoles.Docente
        ? { isActive: true, user: { id: actor.id } }
        : actor.role === UserRoles.Administrador
          ? { isActive: true, user: { institutionId: actor.institutionId } }
          : { isActive: true, course: { users: { id: actor.id } } };

    const assignments = await this.assignmentRepository.find({
      where,
      relations: ASSIGNMENT_RELATIONS,
    });

    return assignments.map((assignment) => this.limitStudentSubmissions(assignment, actor));
  }

  async findOne(id: string, actor: User): Promise<Assignment> {
    const assignment = await this.assignmentRepository.findOne({
      where: { id },
      relations: ASSIGNMENT_RELATIONS,
    });

    if (!assignment)
      throw new BadRequestException(`No se encontró la tarea con identificador ${id}.`);

    const canAccess =
      actor.isPlatformAdmin ||
      (actor.role === UserRoles.Docente && assignment.user?.id === actor.id) ||
      (actor.role === UserRoles.Administrador &&
        assignment.user?.institutionId === actor.institutionId) ||
      (actor.role === UserRoles.Estudiante &&
        assignment.isActive &&
        Boolean(assignment.course?.users?.some((student) => student.id === actor.id)));
    if (!canAccess) throw new ForbiddenException('No puedes acceder a esta tarea.');

    return this.limitStudentSubmissions(assignment, actor);
  }

  async update(id: string, input: UpdateAssignmentInput, teacher: User): Promise<Assignment> {
    this.assertTeacher(teacher);
    await this.findOne(id, teacher);

    const { id: _, rubricId, courseId, ...toUpdate } = input;
    const [course, rubric] = await Promise.all([
      courseId ? this.findOwnedCourse(courseId, teacher) : Promise.resolve(undefined),
      rubricId ? this.findOwnedRubric(rubricId, teacher) : Promise.resolve(undefined),
    ]);

    const assignment = await this.assignmentRepository.preload({
      id,
      ...toUpdate,
      ...(course ? { course } : {}),
      ...(rubric ? { rubric } : {}),
    });

    if (!assignment)
      throw new NotFoundException(`No se encontró la tarea con identificador ${id}.`);

    return this.assignmentRepository.save(assignment);
  }

  async remove(id: string, teacher: User): Promise<Assignment> {
    this.assertTeacher(teacher);
    const assignment = await this.findOne(id, teacher);
    await this.assignmentRepository.remove(assignment);
    return { ...assignment, id };
  }

  async block(id: string, teacher: User): Promise<Assignment> {
    this.assertTeacher(teacher);
    const assignment = await this.findOne(id, teacher);
    assignment.isActive = false;
    return this.assignmentRepository.save(assignment);
  }

  private async findOwnedCourse(id: string, teacher: User): Promise<Course> {
    const course = await this.courseRepository.findOne({
      where: { id, user: { id: teacher.id } },
      relations: ['user'],
    });
    if (!course)
      throw new ForbiddenException('El curso no existe o no pertenece al docente actual.');
    return course;
  }

  private async findOwnedRubric(id: string, teacher: User): Promise<Rubric> {
    const rubric = await this.rubricRepository.findOne({
      where: { id, user: { id: teacher.id } },
      relations: ['user'],
    });
    if (!rubric)
      throw new ForbiddenException('La rúbrica no existe o no pertenece al docente actual.');
    return rubric;
  }

  private limitStudentSubmissions(assignment: Assignment, actor: User): Assignment {
    if (actor.role !== UserRoles.Estudiante) return assignment;
    return {
      ...assignment,
      course: assignment.course
        ? {
            ...assignment.course,
            users: (assignment.course.users ?? []).filter((student) => student.id === actor.id),
          }
        : assignment.course,
      submissions: (assignment.submissions ?? []).filter(
        (submission) => submission.student?.id === actor.id
      ),
    };
  }

  private assertTeacher(actor: User): void {
    if (actor.role !== UserRoles.Docente)
      throw new ForbiddenException('Solo un docente puede administrar tareas.');
  }
}
