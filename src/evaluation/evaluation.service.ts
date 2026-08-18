import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
// DTOs
import { CreateEvaluationInput, CreateManualEvaluationInput, UpdateEvaluationInput } from './dto';
// TypeORM
import { DataSource, EntityManager, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
// Entities
import { Evaluation } from './entities/evaluation.entity';
import { Submission } from 'src/submission/entities/submission.entity';
// Enums
import { EvaluationOrigin, EvaluationStatus, SubmissionStatus } from 'src/enums';
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
    private readonly dataSource: DataSource,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly notificationQueue: NotificationQueueService,
    @InjectQueue('grading') private readonly gradingQueue: Queue
  ) {}

  async createDraft(createEvaluationInput: CreateEvaluationInput): Promise<Evaluation> {
    return this.dataSource.transaction((manager) =>
      this.createDraftInTransaction(manager, createEvaluationInput, EvaluationOrigin.AI)
    );
  }

  async createManualDraft(input: CreateManualEvaluationInput, teacher: User): Promise<Evaluation> {
    if (teacher.role !== UserRoles.Docente)
      throw new ForbiddenException('Solo un docente puede crear una calificación manual.');

    const evaluation = await this.dataSource.transaction(async (manager) => {
      const submissionRepository = manager.getRepository(Submission);
      const evaluationRepository = manager.getRepository(Evaluation);
      await this.lockSubmission(submissionRepository, input.submissionId);
      const submission = await submissionRepository.findOne({
        where: { id: input.submissionId },
        relations: ['assignment', 'assignment.user', 'assignment.rubric'],
      });
      if (!submission)
        throw new NotFoundException(`No se encontró la entrega ${input.submissionId}.`);
      if (submission.assignment?.user?.id !== teacher.id)
        throw new ForbiddenException(
          'No puedes calificar manualmente una entrega de otro docente.'
        );

      const existingEvaluation = await evaluationRepository.findOne({
        where: { submission: { id: input.submissionId } },
        relations: this.evaluationRelations,
      });
      if (existingEvaluation) {
        if (
          existingEvaluation.origin === EvaluationOrigin.MANUAL &&
          existingEvaluation.status === EvaluationStatus.DRAFT
        )
          return existingEvaluation;
        throw new ConflictException('La entrega ya tiene una evaluación creada.');
      }
      if (submission.status !== SubmissionStatus.FAILED)
        throw new BadRequestException(
          'Solo se puede iniciar una calificación manual para una entrega fallida.'
        );

      this.validateScore(input.totalScore, submission.assignment.rubric?.maxTotalScore);
      const feedback = input.generalFeedback.trim();
      if (!feedback) throw new BadRequestException('La retroalimentación manual es obligatoria.');

      const manualEvaluation = evaluationRepository.create({
        totalScore: input.totalScore,
        generalFeedback: feedback,
        detailedFeedback: input.detailedFeedback ?? [],
        origin: EvaluationOrigin.MANUAL,
        status: EvaluationStatus.DRAFT,
        submission: { id: input.submissionId } as Submission,
      });
      const saved = await evaluationRepository.save(manualEvaluation);
      await submissionRepository.update(input.submissionId, {
        status: SubmissionStatus.REVIEW_PENDING,
      });
      return saved;
    });

    await this.cancelPendingGradingJobs(input.submissionId);
    return evaluation;
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

  private async createDraftInTransaction(
    manager: EntityManager,
    input: CreateEvaluationInput,
    origin: EvaluationOrigin
  ): Promise<Evaluation> {
    const submissionRepository = manager.getRepository(Submission);
    const evaluationRepository = manager.getRepository(Evaluation);
    await this.lockSubmission(submissionRepository, input.submissionId);
    const submission = await submissionRepository.findOne({
      where: { id: input.submissionId },
    });
    if (!submission)
      throw new NotFoundException(`No se encontró la entrega ${input.submissionId}.`);

    const existingEvaluation = await evaluationRepository.findOne({
      where: { submission: { id: input.submissionId } },
      relations: this.evaluationRelations,
    });
    if (existingEvaluation) return existingEvaluation;

    const { submissionId, ...evaluationData } = input;
    const evaluation = evaluationRepository.create({
      ...evaluationData,
      origin,
      submission: { id: submissionId } as Submission,
      status: EvaluationStatus.DRAFT,
    });
    const savedEvaluation = await evaluationRepository.save(evaluation);
    await submissionRepository.update(submissionId, {
      status: SubmissionStatus.REVIEW_PENDING,
    });
    return savedEvaluation;
  }

  private async lockSubmission(
    repository: Repository<Submission>,
    submissionId: string
  ): Promise<void> {
    const submission = await repository.findOne({
      where: { id: submissionId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!submission) throw new NotFoundException(`No se encontró la entrega ${submissionId}.`);
  }

  private validateScore(score: number, rawMaxScore: number | undefined): void {
    const maxScore = Number(rawMaxScore);
    if (!Number.isFinite(score) || score < 0 || !Number.isFinite(maxScore) || score > maxScore)
      throw new BadRequestException(`La calificación debe estar entre 0 y ${maxScore}.`);
  }

  private async cancelPendingGradingJobs(submissionId: string): Promise<void> {
    try {
      const jobs = await this.gradingQueue.getJobs([
        'waiting',
        'delayed',
        'prioritized',
        'paused',
        'failed',
      ]);
      const removals = await Promise.allSettled(
        jobs.filter((job) => job.data?.id === submissionId).map((job) => job.remove())
      );
      const failedRemovals = removals.filter((result) => result.status === 'rejected').length;
      if (failedRemovals > 0)
        this.logger.warn(
          `No se pudieron retirar ${failedRemovals} trabajos de calificación para ${submissionId}.`
        );
    } catch (error) {
      this.logger.error(
        `No se pudieron consultar los trabajos de calificación para ${submissionId}: ${
          error instanceof Error ? error.message : String(error)
        }.`
      );
    }
  }
}
