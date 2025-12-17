// Nest/Exceptions
import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
// Logger
import { Logger } from '@nestjs/common';
// TypeORM
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
// Dto
import { CreateCriterionInput, UpdateCriterionInput } from './dto';
// Entities
import { Criterion } from './entities/criterion.entity';

@Injectable()
export class CriterionService {
  private readonly logger = new Logger('CriterionService');

  constructor(
    @InjectRepository(Criterion)
    private criterionRepository: Repository<Criterion>
  ) {}

  async create(createCriterionInput: CreateCriterionInput) {
    try {
      const criterion = this.criterionRepository.create(createCriterionInput);
      return await this.criterionRepository.save(criterion);
    } catch (error) {
      this.handleDBException(error);
    }
  }

  async findAll() {
    return await this.criterionRepository.find({ relations: ['rubric'] });
  }

  async findOne(id: string) {
    try {
      return await this.criterionRepository.findOneOrFail({ where: { id }, relations: ['rubric'] });
    } catch (error) {
      this.handleDBException(error);
    }
  }

  async update(id: string, updateCriterionInput: UpdateCriterionInput) {
    try {
      const criterion = await this.findOne(id);
      return await this.criterionRepository.save({ ...criterion, ...updateCriterionInput });
    } catch (error) {
      this.handleDBException(error);
    }
  }

  async remove(id: string) {
    const criterion = await this.findOne(id);
    await this.criterionRepository.remove(criterion);
    return { ...criterion, id };
  }

  private handleDBException(error: any): never {
    if (error.code === '23505') throw new BadRequestException(error.detail.replace('Key ', ''));

    if (error.code === 'error-001') throw new BadRequestException(error.detail.replace('Key ', ''));

    this.logger.error(error);
    throw new InternalServerErrorException('Unexpected error, please check server logs');
  }
}
