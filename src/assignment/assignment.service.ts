// NestJS
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
// DTO
import { CreateAssignmentInput, UpdateAssignmentInput } from './dto';
// TypeORM
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
// Entities
import { Assignment } from './entities/assignment.entity';

@Injectable()
export class AssignmentService {
  private readonly logger = new Logger('AssignmentService');

  constructor(
    @InjectRepository(Assignment)
    private readonly assignmentRepository: Repository<Assignment>
  ) {}

  async create(createAssignmentInput: CreateAssignmentInput): Promise<Assignment> {
    try {
      const assignment = this.assignmentRepository.create({
        ...createAssignmentInput,
        rubric: { id: createAssignmentInput.rubricId } as any,
        teacher: { id: createAssignmentInput.teacherId } as any,
      });

      const savedAssignment = await this.assignmentRepository.save(assignment);
      return this.findOne(savedAssignment.id);
    } catch (error) {
      this.handleDBException(error);
    }
  }

  async findAll(): Promise<Assignment[]> {
    return await this.assignmentRepository.find({
      relations: ['rubric', 'teacher'],
      where: { isActive: true }, // Opcional: solo traer activas por defecto
    });
  }

  async findOne(id: string): Promise<Assignment> {
    const assignment = await this.assignmentRepository.findOne({
      where: { id },
      relations: ['rubric', 'teacher', 'rubric.criteria'], // Cargamos todo para la IA
    });
    if (!assignment) throw new BadRequestException(`Assignment with id ${id} not found`);
    return assignment;
  }

  async update(id: string, updateAssignmentInput: UpdateAssignmentInput): Promise<Assignment> {
    const { rubricId, teacherId, ...toUpdate } = updateAssignmentInput;

    const assignment = await this.assignmentRepository.preload({
      id,
      ...toUpdate,
      // Si cambian la rúbrica, la re-asignamos
      rubric: rubricId ? ({ id: rubricId } as any) : undefined,
    });

    if (!assignment) throw new NotFoundException(`Assignment with id ${id} not found`);

    try {
      return await this.assignmentRepository.save(assignment);
    } catch (error) {
      this.handleDBException(error);
    }
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

  private handleDBException(error: any): never {
    if (error.code === '23503')
      // Error de llave foránea (ej: rubricId no existe)
      throw new BadRequestException('The referenced Rubric or Teacher does not exist.');

    if (error.code === '23505') throw new BadRequestException(error.detail.replace('Key ', ''));

    if (error.code === 'error-001') throw new BadRequestException(error.detail.replace('Key ', ''));

    this.logger.error(error);
    throw new InternalServerErrorException('Unexpected error, please check server logs');
  }
}
