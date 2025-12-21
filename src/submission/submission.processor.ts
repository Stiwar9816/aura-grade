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

  async process(job: Job<any, any, string>): Promise<any> {
    const { id, url } = job.data;
    this.logger.log(`Processing grading job ${job.id} for submission ${id}`);

    try {
      // 1. Extracción de texto
      await job.updateProgress(10);
      const text = await this.extractorService.extractTextFromUrl(url);
      await job.updateProgress(30);

      // 2. Obtener datos de la entrega
      const submission = await this.submissionRepository.findOne({
        where: { id },
        relations: ['student', 'assignment', 'assignment.rubric'],
      });

      if (!submission) {
        this.logger.error(`Submission with id ${id} not found`);
        return;
      }

      // 3. Actualización de estado
      await this.submissionRepository.update(id, {
        extractedText: text,
        status: SubmissionStatus.IN_PROGRESS,
      });

      await job.updateProgress(40);

      // 4. Ejecutar la Evaluación con IA
      this.logger.log(`Calling AI for grading submission ${id}`);
      const cleanText = AiSanitizer.clean(text);

      const aiResponse = await this.aiService.evaluateSubmission(
        cleanText,
        submission.assignment.rubric,
        submission.assignment.title
      );
      await job.updateProgress(80);

      // 5. Guardar la evaluación
      const evaluation = await this.evaluationService.create({
        submissionId: id,
        totalScore: aiResponse.totalScore,
        generalFeedback: aiResponse.generalFeedback,
        detailedFeedback: aiResponse.detailedFeedback,
        aiModelUsed: this.config.get('AI_PROVIDER'),
      });
      await job.updateProgress(90);

      // 6. Notificación y progreso final
      await job.updateProgress(100);
      this.logger.log(
        `AI grading draft saved with ID ${evaluation.id}. Waiting for teacher review.`
      );

      this.notificationsGateway.notifyStudent('gradingCompleted', {
        submissionId: id,
        status: 'DRAFT_SAVED',
      });

      return {
        evaluationId: evaluation.id,
        score: evaluation.totalScore,
        status: 'DRAFT_SAVED',
      };
    } catch (error) {
      this.logger.error(`Failed processing submission ${id}: ${error.message}`);
      await this.submissionRepository.update(id, { status: SubmissionStatus.FAILED });

      // Lanza el error para que BullMQ registre el fallo y pueda reintentar según la configuración
      throw error;
    }
  }
}
