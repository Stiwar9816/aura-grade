import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { randomUUID, createHash } from 'crypto';
import { hasValidDocxDirectory } from 'src/common/helpers/docx-validation';
import { recordOutboxEvent } from 'src/outbox/outbox';
import { ExtractorService } from 'src/extractor/extractor.service';
import { AiSanitizer } from 'src/common/helpers/ai-sanitizer.helper';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
// TypeORM
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
// DTOs
import { CreateSubmissionInput } from './dto';
// Entities
import { Submission } from './entities/submission.entity';
import { Assignment } from 'src/assignment/entities/assignment.entity';
// Enums
import { EvaluationStatus, SubmissionStatus } from 'src/enums';
import { UserRoles } from 'src/auth/enums';
// FileUpload
import { FileUpload } from 'graphql-upload-ts';
import { User } from 'src/user/entities/user.entity';
import { NotificationQueueService } from 'src/notifications/notification-queue.service';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { getEffectiveAssignmentDueDate } from 'src/assignment/assignment-deadline';

const MAX_SUBMISSION_FILE_SIZE = 15 * 1024 * 1024;
const ALLOWED_DOCX_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream',
  'application/zip',
  'application/x-zip-compressed',
]);

@Injectable()
export class SubmissionService {
  private readonly logger = new Logger('SubmissionService');
  private readonly submissionRelations = [
    'assignment',
    'assignment.user',
    'assignment.course',
    'assignment.course.user',
    'assignment.rubric',
    'assignment.rubric.criteria',
    'student',
    'evaluation',
    'evaluation.reevaluationRequest',
    'evaluation.reevaluationRequest.student',
    'evaluation.reevaluationRequest.teacher',
  ];

  constructor(
    @InjectRepository(Submission)
    private readonly submissionRepository: Repository<Submission>,
    @InjectRepository(Assignment)
    private readonly assignmentRepository: Repository<Assignment>,
    @InjectQueue('grading') private readonly gradingQueue: Queue,
    private readonly cloudinaryService: CloudinaryService,
    private readonly notificationQueue: NotificationQueueService,
    private readonly extractor: ExtractorService
  ) {}

  async create(
    file: FileUpload,
    createSubmissionInput: CreateSubmissionInput,
    user: User
  ): Promise<Submission> {
    this.assertStudent(user);
    const { assignmentId, idempotencyKey } = createSubmissionInput;
    const existing = await this.submissionRepository.findOne({
      where: { student: { id: user.id }, idempotencyKey },
      relations: ['assignment'],
    });
    if (existing) {
      if (existing.assignment?.id && existing.assignment.id !== assignmentId)
        throw new ConflictException('La clave del envío pertenece a otra tarea.');
      return this.findOne(existing.id, user);
    }
    // Validate ownership before accepting or storing bytes.
    await this.assertAccepting(assignmentId, user);
    const fileBuffer = await this.readAndValidateDocx(file);
    const extractedText = AiSanitizer.clean(await this.extractor.extractFromBuffer(fileBuffer));
    const contentHash = createHash('sha256').update(fileBuffer).digest('hex');
    const storedFile = await this.cloudinaryService.uploadSubmission(fileBuffer);
    let saved: Submission;
    try {
      saved = await this.submissionRepository.manager.transaction(async (manager) => {
        // Shares the assignment lock with editing/publication; check again after upload.
        await manager
          .getRepository(Assignment)
          .findOne({ where: { id: assignmentId }, lock: { mode: 'pessimistic_write' } });
        const submissions = manager.getRepository(Submission);
        const repeated = await submissions.findOne({
          where: { student: { id: user.id }, idempotencyKey },
          relations: ['assignment'],
        });
        if (repeated) {
          if (repeated.assignment.id !== assignmentId || repeated.contentHash !== contentHash)
            throw new ConflictException(
              'La clave del envío ya se utilizó para otro archivo o tarea.'
            );
          return repeated;
        }
        await this.assertAccepting(
          assignmentId,
          user,
          manager.getRepository(Assignment),
          submissions
        );
        const submission = await submissions.save(
          submissions.create({
            fileUrl: storedFile.secureUrl,
            cloudinaryPublicId: storedFile.publicId,
            extractedText,
            contentHash,
            idempotencyKey,
            assignment: { id: assignmentId },
            student: { id: user.id },
            status: SubmissionStatus.PENDING,
          })
        );
        await recordOutboxEvent(manager, 'grading', submission.id);
        await recordOutboxEvent(manager, 'new-submission', submission.id);
        return submission;
      });
    } catch (error) {
      await this.cleanupFailedSubmission(storedFile.publicId);
      throw error;
    }
    if (saved.cloudinaryPublicId !== storedFile.publicId)
      await this.cleanupFailedSubmission(storedFile.publicId);
    return this.hideStudentDraft(saved, user);
  }

  private async assertAccepting(
    assignmentId: string,
    user: User,
    assignments = this.assignmentRepository,
    submissions = this.submissionRepository
  ): Promise<void> {
    const assignment = await assignments.findOne({
      where: { id: assignmentId },
      relations: ['course', 'course.users', 'extensions', 'extensions.student'],
    });
    if (!assignment) throw new NotFoundException('No se encontró la tarea.');
    if (!assignment.isActive)
      throw new BadRequestException('Esta tarea no está activa y no acepta entregas.');
    if (!assignment.course?.users?.some((student) => student.id === user.id))
      throw new ForbiddenException('No estás matriculado en el curso de esta tarea.');
    if (new Date() > getEffectiveAssignmentDueDate(assignment, user.id))
      throw new BadRequestException('La fecha límite de esta tarea ya pasó.');
    if (
      await submissions.exists({
        where: {
          assignment: { id: assignmentId },
          student: { id: user.id },
          evaluation: { status: EvaluationStatus.PUBLISHED },
        },
      })
    )
      throw new BadRequestException('Esta tarea ya fue calificada y no acepta nuevas versiones.');
  }

  async download(id: string, actor: User): Promise<string> {
    const submission = await this.findOne(id, actor);
    if (!submission.cloudinaryPublicId)
      throw new NotFoundException(
        'El documento requiere migración a almacenamiento privado. Contacta a soporte.'
      );
    return this.cloudinaryService.downloadUrl(submission.cloudinaryPublicId);
  }

  async findAll(actor: User): Promise<Submission[]> {
    const where = actor.isPlatformAdmin
      ? {}
      : actor.role === UserRoles.Docente
        ? { assignment: { user: { id: actor.id } } }
        : actor.role === UserRoles.Administrador
          ? { assignment: { user: { institutionId: actor.institutionId } } }
          : { student: { id: actor.id } };

    const submissions = await this.submissionRepository.find({
      where,
      relations: this.submissionRelations,
    });
    return submissions.map((submission) => this.hideStudentDraft(submission, actor));
  }

  async findOne(id: string, actor: User): Promise<Submission> {
    const submission = await this.submissionRepository.findOne({
      where: { id },
      relations: this.submissionRelations,
    });

    if (!submission)
      throw new NotFoundException(`No se encontró la entrega con identificador ${id}.`);

    const canAccess =
      actor.isPlatformAdmin ||
      (actor.role === UserRoles.Docente && submission.assignment?.user?.id === actor.id) ||
      (actor.role === UserRoles.Administrador &&
        submission.assignment?.user?.institutionId === actor.institutionId) ||
      (actor.role === UserRoles.Estudiante && submission.student?.id === actor.id);
    if (!canAccess) throw new ForbiddenException('No puedes acceder a esta entrega.');

    return this.hideStudentDraft(submission, actor);
  }

  async retryGrading(id: string, teacher: User): Promise<Submission> {
    this.assertTeacher(teacher);
    const submission = await this.submissionRepository.findOne({
      where: { id },
      relations: ['student', 'assignment', 'assignment.user', 'evaluation'],
    });
    if (!submission)
      throw new NotFoundException(`No se encontró la entrega con identificador ${id}.`);
    if (submission.assignment?.user?.id !== teacher.id)
      throw new ForbiddenException('No puedes reintentar una entrega de otro docente.');
    if (submission.evaluation)
      throw new BadRequestException('La entrega ya tiene una evaluación y no necesita reintento.');
    if (submission.status !== SubmissionStatus.FAILED)
      throw new BadRequestException('Solo se pueden reintentar entregas con estado fallido.');
    if (!submission.fileUrl)
      throw new BadRequestException('La entrega no tiene un archivo disponible para reprocesar.');

    await this.submissionRepository.manager.transaction(async (manager) => {
      const claimed = await manager
        .getRepository(Submission)
        .update({ id, status: SubmissionStatus.FAILED }, { status: SubmissionStatus.PENDING });
      if ((claimed.affected ?? 0) !== 1)
        throw new ConflictException('La entrega ya fue tomada para reprocesamiento.');
      await recordOutboxEvent(manager, 'grading', id, `grading-${id}-retry-${randomUUID()}`);
    });

    submission.status = SubmissionStatus.PENDING;
    return submission;
  }

  private assertStudent(actor: User): void {
    if (actor.role !== UserRoles.Estudiante)
      throw new ForbiddenException('Solo un estudiante puede crear entregas.');
  }

  private assertTeacher(actor: User): void {
    if (actor.role !== UserRoles.Docente)
      throw new ForbiddenException('Solo un docente puede reintentar una evaluación fallida.');
  }

  private hideStudentDraft(submission: Submission, actor: User): Submission {
    if (actor.role !== UserRoles.Estudiante) return submission;
    return {
      ...submission,
      gradingAttemptCount: undefined,
      gradingFailureReason: undefined,
      gradingLastAttemptAt: undefined,
      evaluation:
        submission.evaluation?.status === EvaluationStatus.PUBLISHED
          ? submission.evaluation
          : undefined,
    };
  }

  private async readAndValidateDocx(file: FileUpload): Promise<Buffer> {
    const { filename, mimetype, createReadStream } = file;
    if (!filename?.toLowerCase().endsWith('.docx'))
      throw new BadRequestException('Solo se permiten archivos .docx para las entregas.');
    if (mimetype && !ALLOWED_DOCX_MIME_TYPES.has(mimetype.toLowerCase()))
      throw new BadRequestException('El tipo MIME del archivo no corresponde a un DOCX.');

    const stream = createReadStream();
    const chunks: Buffer[] = [];
    let size = 0;
    try {
      for await (const chunk of stream) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buffer.length;
        if (size > MAX_SUBMISSION_FILE_SIZE) {
          stream.destroy();
          throw new BadRequestException('El archivo supera el límite de 15 MB.');
        }
        chunks.push(buffer);
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('No se pudo leer el archivo cargado.');
    }

    if (size === 0) throw new BadRequestException('El archivo está vacío.');
    const content = Buffer.concat(chunks, size);
    if (!hasValidDocxDirectory(content))
      throw new BadRequestException('El contenido del archivo no corresponde a un DOCX válido.');

    return content;
  }

  private async cleanupFailedSubmission(
    cloudinaryPublicId: string,
    submission?: Submission
  ): Promise<void> {
    const cleanupResults = await Promise.allSettled([
      this.cloudinaryService.deleteSubmission(cloudinaryPublicId),
      ...(submission ? [this.submissionRepository.remove(submission)] : []),
    ]);
    cleanupResults.forEach((result) => {
      if (result.status === 'rejected')
        this.logger.error(
          'No se pudo eliminar un archivo huérfano de una entrega; revisar almacenamiento.'
        );
    });
  }
}
