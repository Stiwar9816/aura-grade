// NestJS
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
// DTO
import { CreateAssignmentInput, UpdateAssignmentInput } from './dto';
// TypeORM
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
// Entities
import { Assignment } from './entities/assignment.entity';

@Injectable()
export class AssignmentService {
  constructor(
    @InjectRepository(Assignment)
    private readonly assignmentRepository: Repository<Assignment>
  ) {}

  async create(createAssignmentInput: CreateAssignmentInput): Promise<Assignment> {
    const assignment = this.assignmentRepository.create({
      ...createAssignmentInput,
      rubric: { id: createAssignmentInput.rubricId } as any,
      user: { id: createAssignmentInput.userId } as any,
      course: { id: createAssignmentInput.courseId } as any,
    });

    const savedAssignment = await this.assignmentRepository.save(assignment);
    return this.findOne(savedAssignment.id);
  }

  async findAll(): Promise<Assignment[]> {
    return await this.assignmentRepository.find({
      relations: ['rubric', 'user', 'course'],
      where: { isActive: true }, // Opcional: solo traer activas por defecto
    });
  }

  async findOne(id: string): Promise<Assignment> {
    const assignment = await this.assignmentRepository.findOne({
      where: { id },
      relations: ['rubric', 'user', 'course', 'rubric.criteria'], // Cargamos todo para la IA
    });
    if (!assignment) throw new BadRequestException(`Assignment with id ${id} not found`);
    return assignment;
  }

  async update(id: string, updateAssignmentInput: UpdateAssignmentInput): Promise<Assignment> {
    const { rubricId, userId, ...toUpdate } = updateAssignmentInput;

    const assignment = await this.assignmentRepository.preload({
      id,
      ...toUpdate,
      // Si cambian la rúbrica, la re-asignamos
      rubric: rubricId ? ({ id: rubricId } as any) : undefined,
    });

    if (!assignment) throw new NotFoundException(`Assignment with id ${id} not found`);

    return await this.assignmentRepository.save(assignment);
  }

  async remove(id: string): Promise<Assignment> {
    const assignment = await this.findOne(id);
    // En lugar de borrar, podrías hacer "soft delete" cambiando isActive a false
    await this.assignmentRepository.remove(assignment);
    return { ...assignment, id };
  }

  async block(id: string): Promise<Assignment> {
    const assignmentToBlock = await this.findOne(id);
    assignmentToBlock.isActive = false;
    return await this.assignmentRepository.save(assignmentToBlock);
  }
}
