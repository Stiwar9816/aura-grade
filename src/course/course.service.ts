import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
// TypeORM
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
// Dto
import { CreateCourseInput, UpdateCourseInput } from './dto';
// Entities
import { Course } from './entities/course.entity';
import { User } from 'src/user/entities/user.entity';

@Injectable()
export class CourseService {
  private readonly logger = new Logger('CourseService');

  constructor(
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>
  ) {}

  async create(createCourseInput: CreateCourseInput): Promise<Course> {
    try {
      const course = this.courseRepository.create(createCourseInput);
      return await this.courseRepository.save(course);
    } catch (error) {
      this.handleDBException(error);
    }
  }

  async findAll(user: User): Promise<Course[]> {
    return await this.courseRepository.find({
      relations: ['users'],
    });
  }

  async findOne(id: string): Promise<Course> {
    try {
      return await this.courseRepository.findOneOrFail({ where: { id }, relations: ['users'] });
    } catch (error) {
      this.handleDBException({
        code: 'error-001',
        detail: `Course with id ${id} not found`,
      });
    }
  }

  async update(id: string, updateCourseInput: UpdateCourseInput): Promise<Course> {
    try {
      const course = await this.courseRepository.preload({
        id,
        ...updateCourseInput,
      });

      if (!course) throw new BadRequestException(`Course with id ${id} not found`);

      return await this.courseRepository.save(course);
    } catch (error) {
      this.handleDBException(error);
    }
  }

  async remove(id: string): Promise<Course> {
    const course = await this.findOne(id);
    await this.courseRepository.remove(course);
    return { ...course, id };
  }

  // Manejo de excepciones
  private handleDBException(error: any): never {
    if (error.code === '23505') throw new BadRequestException(error.detail.replace('Key ', ''));

    if (error.code === 'error-001') throw new BadRequestException(error.detail.replace('Key ', ''));

    this.logger.error(error);
    throw new InternalServerErrorException('Unexpected error, please check server logs');
  }
}
