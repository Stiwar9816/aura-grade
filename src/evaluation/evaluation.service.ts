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
import { SubmissionStatus } from 'src/enums';

@Injectable()
export class EvaluationService {
  constructor(
    @InjectRepository(Evaluation)
    private readonly evaluationRepository: Repository<Evaluation>,
    @InjectRepository(Submission)
    private readonly submissionRepository: Repository<Submission>
  ) {}

  async create(createEvaluationInput: CreateEvaluationInput): Promise<Evaluation> {
    const { submissionId, ...evaluationData } = createEvaluationInput;

    // 1. Verificar que la entrega existe
    const submission = await this.submissionRepository.findOneBy({ id: submissionId });
    if (!submission) throw new NotFoundException(`Submission ${submissionId} not found`);

    // 2. Crear la evaluación
    const evaluation = this.evaluationRepository.create({
      ...evaluationData,
      submission: { id: submissionId } as any,
    });

    const savedEvaluation = await this.evaluationRepository.save(evaluation);

    // 3. ACTUALIZACIÓN CRÍTICA: Cambiar el estado de la entrega a COMPLETED
    await this.submissionRepository.update(submissionId, {
      status: SubmissionStatus.COMPLETED,
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
