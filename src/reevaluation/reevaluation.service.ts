import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRoles } from 'src/auth/enums';
import { EvaluationStatus, ReEvaluationStatus, SubmissionStatus } from 'src/enums';
import { Evaluation } from 'src/evaluation/entities/evaluation.entity';
import { User } from 'src/user/entities/user.entity';
import { CreateReEvaluationRequestInput, ResolveReEvaluationRequestInput } from './dto';
import { ReEvaluationRequest } from './entities/reevaluation-request.entity';

@Injectable()
export class ReEvaluationService {
  private readonly requestRelations = [
    'evaluation',
    'evaluation.submission',
    'evaluation.submission.student',
    'evaluation.submission.assignment',
    'evaluation.submission.assignment.user',
    'evaluation.submission.assignment.course',
    'evaluation.submission.assignment.course.user',
    'student',
    'teacher',
  ];

  private readonly evaluationRelations = [
    'submission',
    'submission.student',
    'submission.assignment',
    'submission.assignment.user',
    'submission.assignment.course',
    'submission.assignment.course.user',
  ];

  constructor(
    @InjectRepository(ReEvaluationRequest)
    private readonly requestRepository: Repository<ReEvaluationRequest>,
    @InjectRepository(Evaluation)
    private readonly evaluationRepository: Repository<Evaluation>
  ) {}

  async create(
    createReEvaluationRequestInput: CreateReEvaluationRequestInput,
    user: User
  ): Promise<ReEvaluationRequest> {
    const { evaluationId, reason } = createReEvaluationRequestInput;

    const evaluation = await this.evaluationRepository.findOne({
      where: { id: evaluationId },
      relations: this.evaluationRelations,
    });

    if (!evaluation) {
      throw new NotFoundException(`Evaluation with id ${evaluationId} not found`);
    }

    if (
      evaluation.status !== EvaluationStatus.PUBLISHED ||
      evaluation.submission.status !== SubmissionStatus.PUBLISHED
    ) {
      throw new BadRequestException(
        'Only published evaluations can be requested for re-evaluation'
      );
    }

    if (evaluation.submission.student.id !== user.id) {
      throw new ForbiddenException('Only the submission owner can request a re-evaluation');
    }

    const existingRequest = await this.requestRepository.findOne({
      where: { evaluation: { id: evaluationId } },
    });

    if (existingRequest) {
      throw new BadRequestException('Only one re-evaluation request is allowed per evaluation');
    }

    const teacher =
      evaluation.submission.assignment.user ?? evaluation.submission.assignment.course.user;
    if (!teacher) {
      throw new BadRequestException('The evaluation does not have an assigned teacher');
    }

    const request = this.requestRepository.create({
      reason: reason.trim(),
      status: ReEvaluationStatus.PENDING,
      evaluation: { id: evaluationId } as Evaluation,
      student: { id: user.id } as User,
      teacher: { id: teacher.id } as User,
    });

    const savedRequest = await this.requestRepository.save(request);
    return this.findOne(savedRequest.id, user);
  }

  async findAll(user: User): Promise<ReEvaluationRequest[]> {
    if (user.role === UserRoles.Administrador) {
      return this.requestRepository.find({ relations: this.requestRelations });
    }

    if (user.role === UserRoles.Docente) {
      return this.requestRepository.find({
        where: [
          { teacher: { id: user.id } },
          { evaluation: { submission: { assignment: { user: { id: user.id } } } } },
          {
            evaluation: {
              submission: {
                assignment: {
                  course: {
                    user: { id: user.id },
                  },
                },
              },
            },
          },
        ],
        relations: this.requestRelations,
      });
    }

    return this.requestRepository.find({
      where: { student: { id: user.id } },
      relations: this.requestRelations,
    });
  }

  async findOne(id: string, user: User): Promise<ReEvaluationRequest> {
    const request = await this.requestRepository.findOne({
      where: { id },
      relations: this.requestRelations,
    });

    if (!request) {
      throw new NotFoundException(`Re-evaluation request with id ${id} not found`);
    }

    this.assertCanAccess(request, user);
    return request;
  }

  async resolve(
    resolveReEvaluationRequestInput: ResolveReEvaluationRequestInput,
    user: User
  ): Promise<ReEvaluationRequest> {
    const { id, status, teacherResponse } = resolveReEvaluationRequestInput;

    if (status === ReEvaluationStatus.PENDING) {
      throw new BadRequestException('A re-evaluation request cannot be resolved as PENDING');
    }

    const request = await this.findOne(id, user);

    if (request.status !== ReEvaluationStatus.PENDING) {
      throw new BadRequestException('This re-evaluation request has already been resolved');
    }

    request.status = status;
    request.teacherResponse = teacherResponse?.trim();
    request.reviewedAt = new Date();

    const savedRequest = await this.requestRepository.save(request);
    return this.findOne(savedRequest.id, user);
  }

  private assertCanAccess(request: ReEvaluationRequest, user: User) {
    if (user.role === UserRoles.Administrador) return;

    if (user.role === UserRoles.Estudiante && request.student.id === user.id) return;

    if (
      user.role === UserRoles.Docente &&
      (request.teacher.id === user.id ||
        request.evaluation.submission.assignment.user.id === user.id ||
        request.evaluation.submission.assignment.course.user.id === user.id)
    ) {
      return;
    }

    throw new ForbiddenException('You do not have access to this re-evaluation request');
  }
}
