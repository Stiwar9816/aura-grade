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

@Injectable()
export class EvaluationService {
  constructor(
    @InjectRepository(Evaluation)
    private readonly evaluationRepository: Repository<Evaluation>,
    @InjectRepository(Submission)
    private readonly submissionRepository: Repository<Submission>,
    private readonly notificationsGateway: NotificationsGateway
  ) {}

  async create(createEvaluationInput: CreateEvaluationInput): Promise<Evaluation> {
    const { submissionId, ...evaluationData } = createEvaluationInput;

    // 1. Verificar que la entrega existe
    const submission = await this.submissionRepository.findOneBy({ id: submissionId });
    if (!submission) throw new NotFoundException(`Submission ${submissionId} not found`);

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
      relations: ['submission', 'submission.student'],
    });

    if (!evaluation) throw new NotFoundException(`Evaluation with id ${id} not found`);

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

    return savedEvaluation;
  }

  async findAll(): Promise<Evaluation[]> {
    return await this.evaluationRepository.find({
      relations: ['submission'],
    });
  }

  async findOne(id: string): Promise<Evaluation> {
    const evaluation = await this.evaluationRepository.findOne({
      where: { id },
      relations: ['submission', 'submission.student'], // Traemos datos del estudiante para el reporte
    });

    if (!evaluation) throw new NotFoundException(`Evaluation with id ${id} not found`);
    return evaluation;
  }

  async findBySubmission(submissionId: string): Promise<Evaluation> {
    const evaluation = await this.evaluationRepository.findOne({
      where: { submission: { id: submissionId } },
      relations: ['submission'],
    });
    if (!evaluation) throw new NotFoundException('Evaluation not found for this submission');
    return evaluation;
  }

  async update(id: string, updateEvaluationInput: UpdateEvaluationInput): Promise<Evaluation> {
    // Evitamos actualizar el submissionId una vez creada la evaluación
    const { id: _, submissionId: __, ...toUpdate } = updateEvaluationInput;

    const evaluation = await this.evaluationRepository.preload({
      id,
      ...toUpdate,
    });

    if (!evaluation) throw new NotFoundException(`Evaluation with id ${id} not found`);

    return await this.evaluationRepository.save(evaluation);
  }

  async remove(id: string): Promise<boolean> {
    const evaluation = await this.findOne(id);
    await this.evaluationRepository.remove(evaluation);
    return true;
  }
}
