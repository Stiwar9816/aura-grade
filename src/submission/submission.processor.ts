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

@Processor('grading')
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
      const text = await this.extractorService.extractTextFromUrl(url);

      // 2. Obtener datos de la entrega
      const submission = await this.submissionRepository.findOne({
        where: { id },
        relations: ['student', 'assignment', 'assignment.rubric'],
      });

      if (!submission) {
        this.logger.error(`Submission with id ${id} not found`);
        return;
      }

      // 3. Actualización de estado y primera notificación
      await this.submissionRepository.update(id, {
        extractedText: text,
        status: SubmissionStatus.IN_PROGRESS,
      });

      this.notificationsGateway.notifyStudent(submission.student.id, {
        submissionId: id,
        status: SubmissionStatus.IN_PROGRESS,
        message: 'Estamos analizando tu trabajo...',
      });

      // 4. Ejecutar la Evaluación con IA
      this.logger.log(`Calling AI for grading submission ${id}`);
      const aiResponse = await this.aiService.evaluateSubmission(
        text,
        submission.assignment.rubric,
        submission.assignment.title
      );

      // 5. Guardar la evaluación
      const evaluation = await this.evaluationService.create({
        submissionId: id,
        totalScore: aiResponse.totalScore,
        generalFeedback: aiResponse.generalFeedback,
        detailedFeedback: aiResponse.detailedFeedback,
        aiModelUsed: this.config.get('AI_PROVIDER'),
      });

      // 6. Notificación Final
      this.notificationsGateway.notifyStudent(submission.student.id, {
        submissionId: id,
        status: SubmissionStatus.COMPLETED,
        message: '¡Tu calificación está lista!',
        evaluationId: evaluation.id,
      });

      this.logger.log(`Grading completed successfully for submission ${id}`);
    } catch (error) {
      this.logger.error(`Failed processing submission ${id}: ${error.message}`);
      await this.submissionRepository.update(id, { status: SubmissionStatus.FAILED });

      // Intentar notificar el error si tenemos el ID del estudiante
      try {
        const sub = await this.submissionRepository.findOne({
          where: { id },
          relations: ['student'],
        });
        if (sub) {
          this.notificationsGateway.notifyStudent(sub.student.id, {
            submissionId: id,
            status: SubmissionStatus.FAILED,
            message: 'Hubo un error al procesar el archivo o la evaluación.',
          });
        }
      } catch (e) {
        this.logger.error('Could not notify student of failure', e.message);
      }

      // Lanza el error para que BullMQ registre el fallo y pueda reintentar según la configuración
      throw error;
    }
  }
}
