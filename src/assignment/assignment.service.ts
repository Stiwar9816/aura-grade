// NestJS
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
// DTO
import {
  CreateAssignmentInput,
  UpdateAssignmentInput,
  UpsertAssignmentExtensionInput,
} from './dto';
// TypeORM
import { LessThanOrEqual, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
// Entities
import { Assignment } from './entities/assignment.entity';
import { Course } from 'src/course/entities/course.entity';
import { Rubric } from 'src/rubric/entities/rubric.entity';
import { User } from 'src/user/entities/user.entity';
import { UserRoles } from 'src/auth/enums';
import { EvaluationStatus } from 'src/enums';
import { AssignmentExtension } from './entities/assignment-extension.entity';
import { getEffectiveAssignmentDueDate } from './assignment-deadline';

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
  'extensions',
  'extensions.student',
  'extensions.grantedBy',
];

@Injectable()
export class AssignmentService {
  constructor(
    @InjectRepository(Assignment)
    private readonly assignmentRepository: Repository<Assignment>,
    @InjectRepository(AssignmentExtension)
    private readonly extensionRepository: Repository<AssignmentExtension>,
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

    return assignments.map((assignment) => this.scopeAssignment(assignment, actor));
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

    return this.scopeAssignment(assignment, actor);
  }

  async update(id: string, input: UpdateAssignmentInput, teacher: User): Promise<Assignment> {
    this.assertTeacher(teacher);
    const currentAssignment = await this.findOne(id, teacher);

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

    const savedAssignment = await this.assignmentRepository.save(assignment);
    if (course && course.id !== currentAssignment.course?.id) {
      await this.extensionRepository.delete({ assignment: { id } });
    } else if (input.dueDate) {
      await this.extensionRepository.delete({
        assignment: { id },
        extendedDueDate: LessThanOrEqual(new Date(savedAssignment.dueDate)),
      });
    }
    return this.findOne(id, teacher);
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

  async upsertExtension(
    input: UpsertAssignmentExtensionInput,
    teacher: User
  ): Promise<AssignmentExtension> {
    this.assertTeacher(teacher);
    const assignment = await this.findOne(input.assignmentId, teacher);
    if (!assignment.isActive)
      throw new BadRequestException('No se puede prorrogar una tarea inactiva.');
    const student = (assignment.course?.users ?? []).find(
      (candidate) =>
        candidate.id === input.studentId &&
        candidate.role === UserRoles.Estudiante &&
        candidate.isActive !== false
    );
    if (!student)
      throw new BadRequestException('El estudiante no está activo o matriculado en este curso.');
    if (
      (assignment.submissions ?? []).some(
        (submission) => submission.student?.id === input.studentId
      )
    )
      throw new BadRequestException(
        'No se puede prorrogar una tarea que el estudiante ya entregó.'
      );

    const extendedDueDate = new Date(input.extendedDueDate);
    if (
      Number.isNaN(extendedDueDate.getTime()) ||
      extendedDueDate.getTime() <= new Date(assignment.dueDate).getTime()
    )
      throw new BadRequestException(
        'La prórroga debe ser posterior a la fecha límite general de la tarea.'
      );
    if (extendedDueDate.getTime() <= Date.now())
      throw new BadRequestException('La nueva fecha límite debe estar en el futuro.');

    const existing = await this.extensionRepository.findOne({
      where: { assignment: { id: assignment.id }, student: { id: student.id } },
    });
    const extension = existing ?? this.extensionRepository.create();
    extension.assignment = assignment;
    extension.student = student;
    extension.grantedBy = teacher;
    extension.extendedDueDate = extendedDueDate;
    extension.reason = input.reason?.trim() || undefined;
    return this.extensionRepository.save(extension);
  }

  async removeExtension(assignmentId: string, studentId: string, teacher: User): Promise<boolean> {
    this.assertTeacher(teacher);
    await this.findOne(assignmentId, teacher);
    const result = await this.extensionRepository.delete({
      assignment: { id: assignmentId },
      student: { id: studentId },
    });
    return (result.affected ?? 0) > 0;
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

  private scopeAssignment(assignment: Assignment, actor: User): Assignment {
    if (actor.role !== UserRoles.Estudiante)
      return { ...assignment, effectiveDueDate: new Date(assignment.dueDate) };

    const ownExtensions = (assignment.extensions ?? []).filter(
      (extension) => extension.student?.id === actor.id
    );
    return {
      ...assignment,
      effectiveDueDate: getEffectiveAssignmentDueDate(assignment, actor.id),
      extensions: ownExtensions,
      course: assignment.course
        ? {
            ...assignment.course,
            users: (assignment.course.users ?? []).filter((student) => student.id === actor.id),
          }
        : assignment.course,
      submissions: (assignment.submissions ?? [])
        .filter((submission) => submission.student?.id === actor.id)
        .map((submission) => ({
          ...submission,
          gradingAttemptCount: undefined,
          gradingFailureReason: undefined,
          gradingLastAttemptAt: undefined,
          evaluation:
            submission.evaluation?.status === EvaluationStatus.PUBLISHED
              ? submission.evaluation
              : undefined,
        })),
    };
  }

  private assertTeacher(actor: User): void {
    if (actor.role !== UserRoles.Docente)
      throw new ForbiddenException('Solo un docente puede administrar tareas.');
  }
}
