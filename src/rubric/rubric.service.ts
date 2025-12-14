import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
// TypeORM
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
// Dto
import { CreateRubricInput, UpdateRubricInput } from './dto';
// Entities
import { Rubric } from './entities/rubric.entity';

@Injectable()
export class RubricService {
  private readonly logger = new Logger('RubricService');

  constructor(
    @InjectRepository(Rubric)
    private rubricRepository: Repository<Rubric>
  ) {}

  async create(createRubricInput: CreateRubricInput): Promise<Rubric> {
    try {
      const rubric = this.rubricRepository.create(createRubricInput);
      return await this.rubricRepository.save(rubric);
    } catch (error) {
      this.handleDBException(error);
    }
  }

  async findAll(): Promise<Rubric[]> {
    return await this.rubricRepository.find({ relations: ['users'] });
  }

  async findOne(id: string): Promise<Rubric> {
    try {
      return await this.rubricRepository.findOneOrFail({ where: { id }, relations: ['users'] });
    } catch (error) {
      this.handleDBException({
        code: 'error-001',
        detail: `Rubric with id ${id} not found`,
      });
    }
  }

  async update(id: string, updateRubricInput: UpdateRubricInput): Promise<Rubric> {
    try {
      const rubric = await this.findOne(id);
      return await this.rubricRepository.save({ ...rubric, ...updateRubricInput });
    } catch (error) {
      this.handleDBException(error);
    }
  }

  async remove(id: string): Promise<Rubric> {
    const rubric = await this.findOne(id);
    await this.rubricRepository.remove(rubric);
    return { ...rubric, id };
  }

  private handleDBException(error: any): never {
    if (error.code === '23505') throw new BadRequestException(error.detail.replace('Key ', ''));

    if (error.code === 'error-001') throw new BadRequestException(error.detail.replace('Key ', ''));

    this.logger.error(error);
    throw new InternalServerErrorException('Unexpected error, please check server logs');
  }
}
