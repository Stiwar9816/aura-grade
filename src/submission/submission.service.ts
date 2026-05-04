import { BadRequestException, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
// TypeORM
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
// DTOs
import { CreateSubmissionInput, UpdateSubmissionInput } from './dto';
// Entities
import { Submission } from './entities/submission.entity';
import { Assignment } from 'src/assignment/entities/assignment.entity';
// Enums
import { SubmissionStatus } from 'src/enums';
import { UserRoles } from 'src/auth/enums';
// FileUpload
import { FileUpload } from 'graphql-upload-ts';
// Cloudinary
import { v2 as cloudinary } from 'cloudinary';
import { User } from 'src/user/entities/user.entity';

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
  ];

  constructor(
    @InjectRepository(Submission)
    private readonly submissionRepository: Repository<Submission>,
    @InjectRepository(Assignment)
    private readonly assignmentRepository: Repository<Assignment>,
    @InjectQueue('grading') private readonly gradingQueue: Queue
  ) {}

  async create(
    file: FileUpload,
    createSubmissionInput: CreateSubmissionInput,
    user: User
  ): Promise<Submission> {
    const { createReadStream, filename } = file;
    const { assignmentId, studentId, ...submissionData } = createSubmissionInput;
    const effectiveStudentId =
      user.role === UserRoles.Estudiante ? user.id : (studentId ?? user.id);
    if (!effectiveStudentId) {
      throw new BadRequestException('Student id is required');
    }
    // 1. Validaciones previas
    const assignment = await this.assignmentRepository.findOneBy({ id: assignmentId });
    if (!assignment) throw new NotFoundException(`Assignment with id ${assignmentId} not found`);
    if (new Date() > assignment.dueDate)
      throw new BadRequestException('The deadline for this assignment has passed');

    const extension = filename.split('.').pop()?.toLowerCase();
    if (extension !== 'docx') {
      throw new BadRequestException('Only .docx files are allowed for submissions');
    }

    // 2. SUBIDA A CLOUDINARY MEDIANTE STREAMS
    const cloudinaryResponse: any = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'auragrade/submissions',
          resource_type: 'auto', // Permite DOCX, etc.
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

    // 3. Crear registro en base de datos con la URL de Cloudinary
    const submission = this.submissionRepository.create({
      ...submissionData,
      fileUrl: cloudinaryResponse.secure_url, // URL pública de Cloudinary
      assignment: { id: assignmentId },
      student: { id: effectiveStudentId },
      status: SubmissionStatus.PENDING,
    });

    const savedSubmission = await this.submissionRepository.save(submission);

    // 4. Iniciar proceso asíncrono mediante BullMQ (Extracción -> IA -> Evaluación)
    await this.gradingQueue.add(
      'grade-submission',
      { id: savedSubmission.id, url: savedSubmission.fileUrl },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } }
    );

    return savedSubmission;
  }

  async findAll(): Promise<Submission[]> {
    return await this.submissionRepository.find({
      relations: this.submissionRelations,
    });
  }

  async findOne(id: string): Promise<Submission> {
    const submission = await this.submissionRepository.findOne({
      where: { id },
      relations: this.submissionRelations,
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

    return await this.submissionRepository.save(submission);
  }

  async remove(id: string): Promise<Submission> {
    const submission = await this.findOne(id);
    await this.submissionRepository.remove(submission);
    return { ...submission, id };
  }

  async findAllByTeacher(teacherId: string): Promise<Submission[]> {
    return await this.submissionRepository.find({
      where: [
        {
          assignment: {
            user: { id: teacherId },
          },
        },
        {
          assignment: {
            course: {
              user: { id: teacherId },
            },
          },
        },
      ],
      relations: this.submissionRelations,
    });
  }

  async findAllByStudent(studentId: string): Promise<Submission[]> {
    return await this.submissionRepository.find({
      where: {
        student: { id: studentId },
      },
      relations: this.submissionRelations,
    });
  }
}
