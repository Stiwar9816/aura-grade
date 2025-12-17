import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateSubmissionInput } from './dto/inputs/create-submission.input';
import { UpdateSubmissionInput } from './dto/inputs/update-submission.input';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Submission } from './entities/submission.entity';
import { Repository } from 'typeorm';
import { Assignment } from 'src/assignment/entities/assignment.entity';
import { SubmissionStatus } from 'src/enums';

@Injectable()
export class SubmissionService {
  private readonly logger = new Logger('SubmissionService');

  constructor(
    @InjectRepository(Submission)
    private readonly submissionRepository: Repository<Submission>,
    @InjectRepository(Assignment)
    private readonly assignmentRepository: Repository<Assignment>
  ) {}

  async create(createSubmissionInput: CreateSubmissionInput): Promise<Submission> {
    const { assignmentId, studentId, ...submissionData } = createSubmissionInput;

    // 1. Validar si la tarea existe y si aún está en fecha
    const assignment = await this.assignmentRepository.findOneBy({ id: assignmentId });

    if (!assignment) throw new NotFoundException(`Assignment with id ${assignmentId} not found`);

    if (new Date() > assignment.dueDate)
      throw new BadRequestException('The deadline for this assignment has passed');

    try {
      const submission = this.submissionRepository.create({
        ...submissionData,
        assignment: { id: assignmentId },
        student: { id: studentId },
        status: SubmissionStatus.PENDING,
      });

      return await this.submissionRepository.save(submission);
    } catch (error) {
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

  private handleDBException(error: any): never {
    if (error.code === '23503')
      throw new BadRequestException('Foreign key violation: Check student or assignment ID');

    if (error.code === '23505') throw new BadRequestException(error.detail.replace('Key ', ''));

    if (error.code === 'error-001') throw new BadRequestException(error.detail.replace('Key ', ''));

    this.logger.error(error);
    throw new InternalServerErrorException('Unexpected error, please check server logs');
  }
}
