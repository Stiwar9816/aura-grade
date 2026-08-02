import { Injectable, NotFoundException } from '@nestjs/common';
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
import { NotificationsService } from 'src/notifications/notifications.service';

@Injectable()
export class EvaluationService {
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
    private readonly notificationsService: NotificationsService
  ) {}

  async create(createEvaluationInput: CreateEvaluationInput): Promise<Evaluation> {
    const { submissionId, ...evaluationData } = createEvaluationInput;

    // 1. Verificar que la entrega existe
    const submission = await this.submissionRepository.findOneBy({ id: submissionId });
    if (!submission) throw new NotFoundException(`No se encontró la entrega ${submissionId}.`);

    // 2. Crear la evaluación (por defecto en DRAFT según la entidad)
    const evaluation = this.evaluationRepository.create({
      ...evaluationData,
      submission: { id: submissionId } as any,
      status: EvaluationStatus.DRAFT,
    });

    const savedEvaluation = await this.evaluationRepository.save(evaluation);

    // 3. ACTUALIZACIÓN: Cambiar el estado de la entrega a REVIEW_PENDING
    await this.submissionRepository.update(submissionId, {
      status: SubmissionStatus.REVIEW_PENDING,
    });

    return savedEvaluation;
  }

  async publish(id: string, updateEvaluationInput?: UpdateEvaluationInput): Promise<Evaluation> {
    // 1. Cargar evaluación con relaciones
    const evaluation = await this.evaluationRepository.findOne({
      where: { id },
      relations: ['submission', 'submission.student', 'submission.assignment'],
    });

    if (!evaluation)
      throw new NotFoundException(`No se encontró la evaluación con identificador ${id}.`);

    // 2. Aplicar actualizaciones si vienen (ajustes del docente)
    if (updateEvaluationInput) {
      const { id: _, submissionId: __, ...toUpdate } = updateEvaluationInput;
      Object.assign(evaluation, toUpdate);
    }

    // 3. Cambiar a PUBLISHED
    evaluation.status = EvaluationStatus.PUBLISHED;
    const savedEvaluation = await this.evaluationRepository.save(evaluation);

    // 4. Actualizar estado de la entrega a PUBLISHED
    await this.submissionRepository.update(evaluation.submission.id, {
      status: SubmissionStatus.PUBLISHED,
    });

    // 5. Notificar al estudiante ahora que la nota es oficial
    this.notificationsGateway.notifyStudent(evaluation.submission.student.id, {
      submissionId: evaluation.submission.id,
      status: SubmissionStatus.PUBLISHED,
      message: '¡Tu calificación ha sido revisada y publicada!',
      evaluationId: evaluation.id,
    });
    void this.notificationsService.sendPublishedGradeEmail(
      evaluation.submission.student,
      evaluation.submission.assignment.title,
      evaluation.totalScore
    );

    return savedEvaluation;
  }

  async findAll(): Promise<Evaluation[]> {
    return await this.evaluationRepository.find({
      relations: this.evaluationRelations,
    });
  }

  async findAllByTeacher(teacherId: string): Promise<Evaluation[]> {
    return await this.evaluationRepository.find({
      where: [
        {
          submission: {
            assignment: {
              user: { id: teacherId },
            },
          },
        },
        {
          submission: {
            assignment: {
              course: {
                user: { id: teacherId },
              },
            },
          },
        },
      ],
      relations: this.evaluationRelations,
    });
  }

  async findAllByStudent(studentId: string): Promise<Evaluation[]> {
    return await this.evaluationRepository.find({
      where: {
        submission: {
          student: { id: studentId },
        },
      },
      relations: this.evaluationRelations,
    });
  }

  async findOne(id: string): Promise<Evaluation> {
    const evaluation = await this.evaluationRepository.findOne({
      where: { id },
      relations: this.evaluationRelations,
    });

    if (!evaluation)
      throw new NotFoundException(`No se encontró la evaluación con identificador ${id}.`);
    return evaluation;
  }

  async findBySubmission(submissionId: string): Promise<Evaluation> {
    const evaluation = await this.evaluationRepository.findOne({
      where: { submission: { id: submissionId } },
      relations: this.evaluationRelations,
    });
    if (!evaluation)
      throw new NotFoundException('No se encontró una evaluación para esta entrega.');
    return evaluation;
  }

  async update(id: string, updateEvaluationInput: UpdateEvaluationInput): Promise<Evaluation> {
    // Evitamos actualizar el submissionId una vez creada la evaluación
    const { id: _, submissionId: __, ...toUpdate } = updateEvaluationInput;

    const evaluation = await this.evaluationRepository.preload({
      id,
      ...toUpdate,
    });

    if (!evaluation)
      throw new NotFoundException(`No se encontró la evaluación con identificador ${id}.`);

    return await this.evaluationRepository.save(evaluation);
  }

  async remove(id: string): Promise<boolean> {
    const evaluation = await this.findOne(id);
    await this.evaluationRepository.remove(evaluation);
    return true;
  }
}
