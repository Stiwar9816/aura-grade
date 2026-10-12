import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { User } from '../user/entities/user.entity';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { ListFeedbackDto } from './dto/list-feedback.dto';
import { UpdateFeedbackDto } from './dto/update-feedback.dto';
import { FeedbackEntry } from './entities/feedback-entry.entity';
import { FeedbackStatus } from './feedback.enums';

@Injectable()
export class FeedbackService {
  constructor(
    @InjectRepository(FeedbackEntry)
    private readonly feedbackRepository: Repository<FeedbackEntry>
  ) {}

  async create(user: User, input: CreateFeedbackDto) {
    return this.feedbackRepository.save(
      this.feedbackRepository.create({
        category: input.category,
        message: input.message.trim(),
        page: input.page.trim(),
        referenceId: input.referenceId?.trim() || null,
        userId: user.id,
        institutionId: user.institutionId,
        status: FeedbackStatus.OPEN,
      })
    );
  }

  async findMine(user: User) {
    return this.feedbackRepository.find({
      where: { userId: user.id },
      order: { createdAt: 'DESC' },
      take: 20,
    });
  }

  async findForAdministrator(
    administrator: User,
    filters: { status?: FeedbackStatus; page: number; limit: number }
  ) {
    const page = filters.page;
    const limit = filters.limit;
    const query = this.feedbackRepository
      .createQueryBuilder('feedback')
      .leftJoinAndSelect('feedback.user', 'user')
      .select(['feedback', 'user.id', 'user.name', 'user.last_name', 'user.email', 'user.role'])
      .orderBy('feedback.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (!administrator.isPlatformAdmin) {
      query.where('feedback.institution_id = :institutionId', {
        institutionId: administrator.institutionId,
      });
    }
    if (filters.status) query.andWhere('feedback.status = :status', { status: filters.status });

    const [items, total] = await query.getManyAndCount();
    return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  async updateForAdministrator(administrator: User, id: string, input: UpdateFeedbackDto) {
    const feedback = await this.feedbackRepository.findOne({ where: { id } });
    if (!feedback) throw new NotFoundException('No se encontró el comentario.');
    if (!administrator.isPlatformAdmin && feedback.institutionId !== administrator.institutionId) {
      throw new ForbiddenException('No puedes gestionar comentarios de otra institución.');
    }
    feedback.status = input.status;
    feedback.adminNote = input.adminNote || null;
    feedback.resolvedAt = input.status === FeedbackStatus.RESOLVED ? new Date() : null;
    return this.feedbackRepository.save(feedback);
  }
}
