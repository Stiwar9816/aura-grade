// Nest/Exceptions
import { Injectable, NotFoundException } from '@nestjs/common';
// TypeORM
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
// Dto
import { CreateCriterionInput, UpdateCriterionInput } from './dto';
// Entities
import { Criterion } from './entities/criterion.entity';

@Injectable()
export class CriterionService {
  constructor(
    @InjectRepository(Criterion)
    private criterionRepository: Repository<Criterion>
  ) {}

  async create(createCriterionInput: CreateCriterionInput) {
    const { rubric, ...rest } = createCriterionInput;
    const criterion = this.criterionRepository.create({
      ...rest,
      rubric: { id: rubric },
    });
    return await this.criterionRepository.save(criterion);
  }

  async findAll() {
    return await this.criterionRepository.find({ relations: ['rubric'] });
  }

  async findOne(id: string) {
    const criterion = await this.criterionRepository.findOne({
      where: { id },
      relations: ['rubric'],
    });
    if (!criterion) throw new NotFoundException(`Criterion with id ${id} not found`);
    return criterion;
  }

  async update(id: string, updateCriterionInput: UpdateCriterionInput) {
    const criterion = await this.findOne(id);
    const { rubric, ...rest } = updateCriterionInput;
    // If updating rubric is needed, it should be handled similar to create, but for now avoiding the type error
    return await this.criterionRepository.save({ ...criterion, ...rest });
  }

  async remove(id: string) {
    const criterion = await this.findOne(id);
    await this.criterionRepository.remove(criterion);
    return { ...criterion, id };
  }
}
