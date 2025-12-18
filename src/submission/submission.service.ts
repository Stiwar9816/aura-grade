import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
// TypeORM
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
// Services
import { ExtractorService } from 'src/extractor/extractor.service';
import { EvaluationService } from 'src/evaluation/evaluation.service';
import { AiService } from 'src/ai/ai.service';
// DTOs
import { CreateSubmissionInput, UpdateSubmissionInput } from './dto';
// Entities
import { Submission } from './entities/submission.entity';
import { Assignment } from 'src/assignment/entities/assignment.entity';
// Enums
import { SubmissionStatus } from 'src/enums';
// Gateway
import { NotificationsGateway } from 'src/notifications/notifications.gateway';
// FileUpload
import { FileUpload } from 'graphql-upload-ts';
// Cloudinary
import { v2 as cloudinary } from 'cloudinary';
// Config
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SubmissionService {
  private readonly logger = new Logger('SubmissionService');

  constructor(
    @InjectRepository(Submission)
    private readonly submissionRepository: Repository<Submission>,
    @InjectRepository(Assignment)
    private readonly assignmentRepository: Repository<Assignment>,
    private readonly extractorService: ExtractorService,
    private readonly aiService: AiService,
    private readonly evaluationService: EvaluationService,
    private readonly notificationsGateway: NotificationsGateway,
    private config: ConfigService
  ) {}

  async create(
    file: FileUpload,
    createSubmissionInput: CreateSubmissionInput
  ): Promise<Submission> {
    const { createReadStream, filename } = file;
    const { assignmentId, studentId, ...submissionData } = createSubmissionInput;

    // 1. Validaciones previas
    const assignment = await this.assignmentRepository.findOneBy({ id: assignmentId });
    if (!assignment) throw new NotFoundException(`Assignment with id ${assignmentId} not found`);
    if (new Date() > assignment.dueDate)
      throw new BadRequestException('The deadline for this assignment has passed');

    try {
      // 2. SUBIDA A CLOUDINARY MEDIANTE STREAMS
      const extension = filename.split('.').pop(); // extrae pdf o docx
      const cloudinaryResponse: any = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'auragrade/submissions',
            resource_type: 'auto', // Permite PDF, DOCX, etc.
            // USAR EL NOMBRE ORIGINAL (quitando la extensión para el public_id)
            public_id: filename.split('.')[0],
            // FORZAR QUE SE MANTENGA EL FORMATO ORIGINAL
            use_filename: true,
            unique_filename: true,
            format: extension,
          },
          (error, result) => (result ? resolve(result) : reject(error))
        );
        createReadStream().pipe(uploadStream);
      });

      // LOG PARA VERIFICAR LA URL GENERADA
      this.logger.log(`File uploaded to Cloudinary: ${cloudinaryResponse.secure_url}`);

      // 3. Crear registro en base de datos con la URL de Cloudinary
      const submission = this.submissionRepository.create({
        ...submissionData,
        fileUrl: cloudinaryResponse.secure_url, // URL pública de Cloudinary
        assignment: { id: assignmentId },
        student: { id: studentId },
        status: SubmissionStatus.PENDING,
      });

      const savedSubmission = await this.submissionRepository.save(submission);

      // 4. Iniciar proceso asíncrono (Extracción -> IA -> Evaluación)
      this.processExtraction(savedSubmission.id, savedSubmission.fileUrl);

      return savedSubmission;
    } catch (error) {
      this.logger.error(`Error in upload/create: ${error.message}`);
      this.handleDBException(error);
    }
  }

  async findAll(): Promise<Submission[]> {
    return await this.submissionRepository.find({
      relations: ['student', 'assignment'],
    });
  }

  async findOne(id: string): Promise<Submission> {
    const submission = await this.submissionRepository.findOne({
      where: { id },
      relations: ['student', 'assignment', 'assignment.rubric'],
    });

    if (!submission) throw new NotFoundException(`Submission with id ${id} not found`);
    return submission;
  }

  async update(id: string, updateSubmissionInput: UpdateSubmissionInput): Promise<Submission> {
    const { id: _, ...toUpdate } = updateSubmissionInput;

    const submission = await this.submissionRepository.preload({
      id,
      ...toUpdate,
    });

    if (!submission) throw new NotFoundException(`Submission with id ${id} not found`);

    try {
      return await this.submissionRepository.save(submission);
    } catch (error) {
      this.handleDBException(error);
    }
  }

  async remove(id: string): Promise<Submission> {
    const submission = await this.findOne(id);
    await this.submissionRepository.remove(submission);
    return { ...submission, id };
  }

  private async processExtraction(id: string, url: string) {
    try {
      this.logger.log(`Starting text extraction for submission: ${id}`);

      // 1. Extracción de texto
      const text = await this.extractorService.extractTextFromUrl(url);

      // 2. Obtener datos de la entrega (necesitamos el studentId para notificar)
      const submission = await this.findOne(id);

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
      // IMPORTANTE: El create de evaluation ya actualiza el status de la submission a COMPLETED
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
        const sub = await this.findOne(id);
        await this.submissionRepository.update(id, { status: SubmissionStatus.FAILED });
        this.notificationsGateway.notifyStudent(sub.student.id, {
          submissionId: id,
          status: SubmissionStatus.FAILED,
          message: 'Hubo un error al procesar el archivo o la evaluación.',
        });
      } catch (e) {
        this.logger.error('Could not notify student of failure', e.message);
      }
    }
  }

  private handleDBException(error: any): never {
    if (error.code === '23503')
      throw new BadRequestException('Foreign key violation: Check student or assignment ID');

    if (error.code === '23505') throw new BadRequestException(error.detail.replace('Key ', ''));

    if (error.code === 'error-001') throw new BadRequestException(error.detail.replace('Key ', ''));

    this.logger.error(error);
    throw new InternalServerErrorException('Unexpected error, please check server logs');
  }
}
