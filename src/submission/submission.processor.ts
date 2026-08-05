import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
// BullMQ
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
// TypeORM
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
// Services
import { ExtractorService } from 'src/extractor/extractor.service';
import { EvaluationService } from 'src/evaluation/evaluation.service';
import { AiService } from 'src/ai/ai.service';
// Gateways
import { NotificationsGateway } from 'src/notifications/notifications.gateway';
// Entities
import { Submission } from './entities/submission.entity';
// Enums
import { SubmissionStatus } from 'src/enums';
// Helpers
import { AiSanitizer } from 'src/common/helpers/ai-sanitizer.helper';

type GradingJobData = {
  id: string;
  url: string;
};

type GradingJobResult = {
  status: 'SUBMISSION_NOT_FOUND' | 'DRAFT_ALREADY_EXISTS' | 'DRAFT_SAVED';
  evaluationId?: string;
  score?: number;
};

@Processor('grading', { concurrency: 2 })
export class SubmissionProcessor extends WorkerHost {
  private readonly logger = new Logger(SubmissionProcessor.name);

  constructor(
    @InjectRepository(Submission)
    private readonly submissionRepository: Repository<Submission>,
    private readonly extractorService: ExtractorService,
    private readonly aiService: AiService,
    private readonly evaluationService: EvaluationService,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly config: ConfigService
  ) {
    super();
  }

  async process(job: Job<GradingJobData, GradingJobResult, string>): Promise<GradingJobResult> {
    const { id, url } = job.data;
    if (!id || !url) throw new Error('El trabajo de calificación no tiene datos válidos.');
    this.logger.log(`Procesando el trabajo de calificación ${job.id} para la entrega ${id}.`);

    try {
      const submission = await this.submissionRepository.findOne({
        where: { id },
        relations: ['student', 'assignment', 'assignment.rubric', 'evaluation'],
      });

      if (!submission) {
        this.logger.warn(`No se encontró la entrega con identificador ${id}.`);
        return { status: 'SUBMISSION_NOT_FOUND' };
      }

      if (submission.evaluation) {
        await job.updateProgress(100);
        return {
          evaluationId: submission.evaluation.id,
          score: submission.evaluation.totalScore,
          status: 'DRAFT_ALREADY_EXISTS',
        };
      }

      await job.updateProgress(10);
      const text = await this.extractorService.extractTextFromUrl(url);
      await job.updateProgress(30);

      await this.submissionRepository.update(id, {
        extractedText: text,
        status: SubmissionStatus.IN_PROGRESS,
      });

      await job.updateProgress(40);

      this.logger.log(`Solicitando a la IA la calificación de la entrega ${id}.`);
      const cleanText = AiSanitizer.clean(text);

      const aiResponse = await this.aiService.evaluateSubmission(
        cleanText,
        submission.assignment.rubric,
        submission.assignment.title
      );
      await job.updateProgress(80);

      const evaluation = await this.evaluationService.createDraft({
        submissionId: id,
        totalScore: aiResponse.totalScore,
        generalFeedback: aiResponse.generalFeedback,
        detailedFeedback: aiResponse.detailedFeedback,
        aiModelUsed: this.config.get('AI_PROVIDER'),
      });
      await job.updateProgress(90);

      await job.updateProgress(100);
      this.logger.log(
        `Borrador de calificación guardado con identificador ${evaluation.id}. Esperando revisión del docente.`
      );

      this.notificationsGateway.notifyStudent(submission.student.id, {
        submissionId: id,
        status: 'DRAFT_SAVED',
      });

      return {
        evaluationId: evaluation.id,
        score: evaluation.totalScore,
        status: 'DRAFT_SAVED',
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Falló el procesamiento de la entrega ${id}: ${message}`);
      throw error;
    }
  }
}
