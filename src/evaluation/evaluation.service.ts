import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
// DTOs
import { CreateEvaluationInput, UpdateEvaluationInput } from './dto';
// TypeORM
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
// Entities
import { Evaluation } from './entities/evaluation.entity';
import { Submission } from 'src/submission/entities/submission.entity';
// Enums
import { EvaluationStatus, SubmissionStatus } from 'src/enums';
// Gateways
import { NotificationsGateway } from 'src/notifications/notifications.gateway';
import { NotificationQueueService } from 'src/notifications/notification-queue.service';
import { User } from 'src/user/entities/user.entity';
import { UserRoles } from 'src/auth/enums';

@Injectable()
export class EvaluationService {
  private readonly logger = new Logger(EvaluationService.name);
  private readonly evaluationRelations = [
    'submission',
    'submission.student',
    'submission.assignment',
    'submission.assignment.user',
    'submission.assignment.course',
    'submission.assignment.course.user',
    'submission.assignment.rubric',
    'submission.assignment.rubric.criteria',
    'reevaluationRequest',
    'reevaluationRequest.student',
    'reevaluationRequest.teacher',
  ];

  constructor(
    @InjectRepository(Evaluation)
    private readonly evaluationRepository: Repository<Evaluation>,
    @InjectRepository(Submission)
    private readonly submissionRepository: Repository<Submission>,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly notificationQueue: NotificationQueueService
  ) {}

  async createDraft(createEvaluationInput: CreateEvaluationInput): Promise<Evaluation> {
    const { submissionId, ...evaluationData } = createEvaluationInput;

    const submission = await this.submissionRepository.findOneBy({ id: submissionId });
    if (!submission) throw new NotFoundException(`No se encontró la entrega ${submissionId}.`);

    const existingEvaluation = await this.evaluationRepository.findOne({
      where: { submission: { id: submissionId } },
      relations: this.evaluationRelations,
    });
    if (existingEvaluation) return existingEvaluation;

    const evaluation = this.evaluationRepository.create({
      ...evaluationData,
      submission: { id: submissionId } as any,
      status: EvaluationStatus.DRAFT,
    });

    const savedEvaluation = await this.evaluationRepository.save(evaluation);

    await this.submissionRepository.update(submissionId, {
      status: SubmissionStatus.REVIEW_PENDING,
    });

    return savedEvaluation;
  }

  async publish(
    id: string,
    updateEvaluationInput: UpdateEvaluationInput | undefined,
    teacher: User
  ): Promise<Evaluation> {
    const evaluation = await this.evaluationRepository.findOne({
      where: { id },
      relations: this.evaluationRelations,
    });

    if (!evaluation)
      throw new NotFoundException(`No se encontró la evaluación con identificador ${id}.`);
    this.assertTeacherOwner(evaluation, teacher);

    if (updateEvaluationInput) {
      if (updateEvaluationInput.id !== id)
        throw new BadRequestException('La evaluación de la ruta no coincide con la enviada.');
      const { id: _, ...toUpdate } = updateEvaluationInput;
      Object.assign(evaluation, toUpdate);
    }

    const score = Number(evaluation.totalScore);
    const maxScore = Number(evaluation.submission.assignment?.rubric?.maxTotalScore);
    if (!Number.isFinite(score) || score < 0 || !Number.isFinite(maxScore) || score > maxScore)
      throw new BadRequestException(`La calificación debe estar entre 0 y ${maxScore}.`);
    if (!evaluation.generalFeedback?.trim())
      throw new BadRequestException('La retroalimentación final es obligatoria.');

    evaluation.status = EvaluationStatus.PUBLISHED;
    const savedEvaluation = await this.evaluationRepository.save(evaluation);

    await this.submissionRepository.update(evaluation.submission.id, {
      status: SubmissionStatus.PUBLISHED,
    });

    this.notificationsGateway.notifyStudent(evaluation.submission.student.id, {
      submissionId: evaluation.submission.id,
      status: SubmissionStatus.PUBLISHED,
      message: '¡Tu calificación ha sido revisada y publicada!',
      evaluationId: evaluation.id,
    });
    try {
      await this.notificationQueue.enqueuePublishedGrade(savedEvaluation.id);
    } catch (error) {
      this.logger.error(
        `La calificación ${savedEvaluation.id} fue publicada, pero no se pudo encolar su notificación: ${
          error instanceof Error ? error.message : 'error desconocido'
        }`
      );
    }

    return savedEvaluation;
  }

  async findAll(actor: User): Promise<Evaluation[]> {
    const where = actor.isPlatformAdmin
      ? {}
      : actor.role === UserRoles.Docente
        ? { submission: { assignment: { user: { id: actor.id } } } }
        : actor.role === UserRoles.Administrador
          ? {
              submission: {
                assignment: { user: { institutionId: actor.institutionId } },
              },
            }
          : {
              status: EvaluationStatus.PUBLISHED,
              submission: { student: { id: actor.id } },
            };

    return this.evaluationRepository.find({
      where,
      relations: this.evaluationRelations,
    });
  }

  async findOne(id: string, actor: User): Promise<Evaluation> {
    const evaluation = await this.evaluationRepository.findOne({
      where: { id },
      relations: this.evaluationRelations,
    });

    if (!evaluation)
      throw new NotFoundException(`No se encontró la evaluación con identificador ${id}.`);
    this.assertCanRead(evaluation, actor);
    return evaluation;
  }

  async findBySubmission(submissionId: string, actor: User): Promise<Evaluation> {
    const evaluation = await this.evaluationRepository.findOne({
      where: { submission: { id: submissionId } },
      relations: this.evaluationRelations,
    });
    if (!evaluation)
      throw new NotFoundException('No se encontró una evaluación para esta entrega.');
    this.assertCanRead(evaluation, actor);
    return evaluation;
  }

  private assertCanRead(evaluation: Evaluation, actor: User): void {
    const canAccess =
      actor.isPlatformAdmin ||
      (actor.role === UserRoles.Docente &&
        evaluation.submission?.assignment?.user?.id === actor.id) ||
      (actor.role === UserRoles.Administrador &&
        evaluation.submission?.assignment?.user?.institutionId === actor.institutionId) ||
      (actor.role === UserRoles.Estudiante &&
        evaluation.status === EvaluationStatus.PUBLISHED &&
        evaluation.submission?.student?.id === actor.id);
    if (!canAccess) throw new ForbiddenException('No puedes acceder a esta evaluación.');
  }

  private assertTeacherOwner(evaluation: Evaluation, actor: User): void {
    if (
      actor.role !== UserRoles.Docente ||
      evaluation.submission?.assignment?.user?.id !== actor.id
    )
      throw new ForbiddenException(
        'Solo el docente propietario de la tarea puede publicar esta evaluación.'
      );
  }
}
