import { Injectable, NotFoundException } from '@nestjs/common';
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
  constructor(
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>
  ) {}

  async create(createCourseInput: CreateCourseInput): Promise<Course> {
    const course = this.courseRepository.create(createCourseInput);
    return await this.courseRepository.save(course);
  }

  async findAll(user: User): Promise<Course[]> {
    return await this.courseRepository.find({
      relations: ['users'],
    });
  }

  async findOne(id: string): Promise<Course> {
    const course = await this.courseRepository.findOne({ where: { id }, relations: ['users'] });
    if (!course) throw new NotFoundException(`Course with id ${id} not found`);
    return course;
  }

  async update(id: string, updateCourseInput: UpdateCourseInput): Promise<Course> {
    const course = await this.courseRepository.preload({
      id,
      ...updateCourseInput,
    });

    if (!course) throw new NotFoundException(`Course with id ${id} not found`);

    return await this.courseRepository.save(course);
  }

  async remove(id: string): Promise<Course> {
    const course = await this.findOne(id);
    await this.courseRepository.remove(course);
    return { ...course, id };
  }
}
