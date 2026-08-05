import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRoles } from 'src/auth/enums';
import { EvaluationStatus, ReEvaluationStatus, SubmissionStatus } from 'src/enums';
import { Evaluation } from 'src/evaluation/entities/evaluation.entity';
import { User } from 'src/user/entities/user.entity';
import { CreateReEvaluationRequestInput, ResolveReEvaluationRequestInput } from './dto';
import { ReEvaluationRequest } from './entities/reevaluation-request.entity';

@Injectable()
export class ReEvaluationService {
  private readonly requestRelations = [
    'evaluation',
    'evaluation.submission',
    'evaluation.submission.student',
    'evaluation.submission.assignment',
    'evaluation.submission.assignment.user',
    'evaluation.submission.assignment.course',
    'evaluation.submission.assignment.course.user',
    'student',
    'teacher',
  ];

  private readonly evaluationRelations = [
    'submission',
    'submission.student',
    'submission.assignment',
    'submission.assignment.user',
    'submission.assignment.course',
    'submission.assignment.course.user',
  ];

  constructor(
    @InjectRepository(ReEvaluationRequest)
    private readonly requestRepository: Repository<ReEvaluationRequest>,
    @InjectRepository(Evaluation)
    private readonly evaluationRepository: Repository<Evaluation>
  ) {}

  async create(
    createReEvaluationRequestInput: CreateReEvaluationRequestInput,
    user: User
  ): Promise<ReEvaluationRequest> {
    const { evaluationId, reason } = createReEvaluationRequestInput;
    if (user.role !== UserRoles.Estudiante)
      throw new ForbiddenException('Solo un estudiante puede solicitar una reevaluación.');

    const normalizedReason = reason.trim();
    if (normalizedReason.length < 20 || normalizedReason.length > 2000)
      throw new BadRequestException('El motivo debe tener entre 20 y 2000 caracteres.');

    const evaluation = await this.evaluationRepository.findOne({
      where: { id: evaluationId },
      relations: this.evaluationRelations,
    });

    if (!evaluation) {
      throw new NotFoundException(
        `No se encontró la evaluación con identificador ${evaluationId}.`
      );
    }

    if (
      evaluation.status !== EvaluationStatus.PUBLISHED ||
      evaluation.submission.status !== SubmissionStatus.PUBLISHED
    ) {
      throw new BadRequestException(
        'Solo se pueden solicitar reevaluaciones de evaluaciones publicadas.'
      );
    }

    if (evaluation.submission.student.id !== user.id) {
      throw new ForbiddenException(
        'Solo el propietario de la entrega puede solicitar una reevaluación.'
      );
    }

    const existingRequest = await this.requestRepository.findOne({
      where: { evaluation: { id: evaluationId } },
    });

    if (existingRequest) {
      throw new BadRequestException(
        'Solo se permite una solicitud de reevaluación por evaluación.'
      );
    }

    const teacher = evaluation.submission.assignment.user;
    if (!teacher) {
      throw new BadRequestException('La evaluación no tiene un docente asignado.');
    }

    const request = this.requestRepository.create({
      reason: normalizedReason,
      status: ReEvaluationStatus.PENDING,
      evaluation: { id: evaluationId } as Evaluation,
      student: { id: user.id } as User,
      teacher: { id: teacher.id } as User,
    });

    const savedRequest = await this.requestRepository.save(request);
    return this.findOne(savedRequest.id, user);
  }

  async findAll(user: User): Promise<ReEvaluationRequest[]> {
    const where = user.isPlatformAdmin
      ? {}
      : user.role === UserRoles.Administrador
        ? {
            evaluation: {
              submission: {
                assignment: { user: { institutionId: user.institutionId } },
              },
            },
          }
        : user.role === UserRoles.Docente
          ? { evaluation: { submission: { assignment: { user: { id: user.id } } } } }
          : { student: { id: user.id } };

    return this.requestRepository.find({
      where,
      relations: this.requestRelations,
    });
  }

  async findOne(id: string, user: User): Promise<ReEvaluationRequest> {
    const request = await this.requestRepository.findOne({
      where: { id },
      relations: this.requestRelations,
    });

    if (!request) {
      throw new NotFoundException(
        `No se encontró la solicitud de reevaluación con identificador ${id}.`
      );
    }

    this.assertCanAccess(request, user);
    return request;
  }

  async resolve(
    resolveReEvaluationRequestInput: ResolveReEvaluationRequestInput,
    user: User
  ): Promise<ReEvaluationRequest> {
    const { id, status, teacherResponse } = resolveReEvaluationRequestInput;

    if (status === ReEvaluationStatus.PENDING) {
      throw new BadRequestException(
        'Una solicitud de reevaluación no puede resolverse como PENDIENTE.'
      );
    }

    const request = await this.findOne(id, user);
    this.assertCanResolve(request, user);

    if (request.status !== ReEvaluationStatus.PENDING) {
      throw new BadRequestException('Esta solicitud de reevaluación ya fue resuelta.');
    }

    request.status = status;
    const normalizedResponse = teacherResponse.trim();
    if (normalizedResponse.length < 10 || normalizedResponse.length > 2000)
      throw new BadRequestException('La respuesta debe tener entre 10 y 2000 caracteres.');

    request.teacherResponse = normalizedResponse;
    request.reviewedAt = new Date();

    const savedRequest = await this.requestRepository.save(request);
    return this.findOne(savedRequest.id, user);
  }

  private assertCanAccess(request: ReEvaluationRequest, user: User) {
    if (user.isPlatformAdmin) return;

    if (
      user.role === UserRoles.Administrador &&
      request.evaluation.submission.assignment.user.institutionId === user.institutionId
    )
      return;

    if (user.role === UserRoles.Estudiante && request.student.id === user.id) return;

    if (
      user.role === UserRoles.Docente &&
      request.evaluation.submission.assignment.user.id === user.id
    ) {
      return;
    }

    throw new ForbiddenException('No tienes acceso a esta solicitud de reevaluación.');
  }

  private assertCanResolve(request: ReEvaluationRequest, user: User): void {
    if (
      user.role !== UserRoles.Docente ||
      request.evaluation.submission.assignment.user.id !== user.id
    )
      throw new ForbiddenException(
        'Solo el docente propietario de la tarea puede resolver esta solicitud.'
      );
  }
}
