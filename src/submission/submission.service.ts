import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
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
import { NotificationsService } from 'src/notifications/notifications.service';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';

const MAX_SUBMISSION_FILE_SIZE = 15 * 1024 * 1024;
const MAX_DOCX_UNCOMPRESSED_SIZE = 50 * 1024 * 1024;
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
    private readonly notificationsService: NotificationsService
  ) {}

  async create(
    file: FileUpload,
    createSubmissionInput: CreateSubmissionInput,
    user: User
  ): Promise<Submission> {
    this.assertStudent(user);
    const { assignmentId, ...submissionData } = createSubmissionInput;
    // 1. Validaciones previas
    const assignment = await this.assignmentRepository.findOne({
      where: { id: assignmentId },
      relations: ['user', 'course', 'course.user', 'course.users'],
    });
    if (!assignment)
      throw new NotFoundException(`No se encontró la tarea con identificador ${assignmentId}.`);
    if (!assignment.isActive)
      throw new BadRequestException('Esta tarea no está activa y no acepta entregas.');
    if (!assignment.course?.users?.some((student) => student.id === user.id))
      throw new ForbiddenException('No estás matriculado en el curso de esta tarea.');
    if (new Date() > assignment.dueDate)
      throw new BadRequestException('La fecha límite de esta tarea ya pasó.');

    const fileBuffer = await this.readAndValidateDocx(file);
    const storedFile = await this.cloudinaryService.uploadSubmission(fileBuffer);

    const submission = this.submissionRepository.create({
      ...submissionData,
      fileUrl: storedFile.secureUrl,
      assignment: { id: assignmentId },
      student: { id: user.id },
      status: SubmissionStatus.PENDING,
    });

    let savedSubmission: Submission | undefined;
    try {
      savedSubmission = await this.submissionRepository.save(submission);

      await this.gradingQueue.add(
        'grade-submission',
        { id: savedSubmission.id, url: savedSubmission.fileUrl },
        {
          jobId: savedSubmission.id,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: { age: 86400, count: 1000 },
          removeOnFail: { age: 604800, count: 5000 },
        }
      );
    } catch (error) {
      await this.cleanupFailedSubmission(storedFile.publicId, savedSubmission);
      throw error;
    }

    const teacher = assignment.user;
    void this.notificationsService.sendNewSubmissionEmail(teacher, user, assignment);

    return savedSubmission;
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

  private assertStudent(actor: User): void {
    if (actor.role !== UserRoles.Estudiante)
      throw new ForbiddenException('Solo un estudiante puede crear entregas.');
  }

  private hideStudentDraft(submission: Submission, actor: User): Submission {
    if (
      actor.role !== UserRoles.Estudiante ||
      submission.evaluation?.status === EvaluationStatus.PUBLISHED
    )
      return submission;
    return { ...submission, evaluation: undefined };
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
    if (!this.hasValidDocxDirectory(content))
      throw new BadRequestException('El contenido del archivo no corresponde a un DOCX válido.');

    return content;
  }

  private hasValidDocxDirectory(content: Buffer): boolean {
    if (content.length < 22 || content.readUInt32LE(0) !== 0x04034b50) return false;

    const searchStart = Math.max(0, content.length - 65557);
    let endOfCentralDirectory = -1;
    for (let offset = content.length - 22; offset >= searchStart; offset -= 1) {
      if (content.readUInt32LE(offset) === 0x06054b50) {
        endOfCentralDirectory = offset;
        break;
      }
    }
    if (endOfCentralDirectory < 0) return false;

    const totalEntries = content.readUInt16LE(endOfCentralDirectory + 10);
    const centralDirectorySize = content.readUInt32LE(endOfCentralDirectory + 12);
    const centralDirectoryOffset = content.readUInt32LE(endOfCentralDirectory + 16);
    if (totalEntries === 0 || centralDirectoryOffset + centralDirectorySize > endOfCentralDirectory)
      return false;

    const entries = new Set<string>();
    let totalUncompressedSize = 0;
    let cursor = centralDirectoryOffset;
    for (let index = 0; index < totalEntries; index += 1) {
      if (cursor + 46 > endOfCentralDirectory || content.readUInt32LE(cursor) !== 0x02014b50)
        return false;

      const flags = content.readUInt16LE(cursor + 8);
      const compressionMethod = content.readUInt16LE(cursor + 10);
      const uncompressedSize = content.readUInt32LE(cursor + 24);
      const fileNameLength = content.readUInt16LE(cursor + 28);
      const extraLength = content.readUInt16LE(cursor + 30);
      const commentLength = content.readUInt16LE(cursor + 32);
      const nextCursor = cursor + 46 + fileNameLength + extraLength + commentLength;
      if (
        (flags & 0x1) !== 0 ||
        ![0, 8].includes(compressionMethod) ||
        uncompressedSize === 0xffffffff ||
        nextCursor > endOfCentralDirectory
      )
        return false;

      totalUncompressedSize += uncompressedSize;
      if (totalUncompressedSize > MAX_DOCX_UNCOMPRESSED_SIZE) return false;
      entries.add(content.toString('utf8', cursor + 46, cursor + 46 + fileNameLength));
      cursor = nextCursor;
    }

    return entries.has('[Content_Types].xml') && entries.has('word/document.xml');
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
          `No se pudo completar la limpieza: ${result.reason?.message ?? result.reason}`
        );
    });
  }
}
