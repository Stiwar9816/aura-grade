import { Injectable, NotFoundException } from '@nestjs/common';
// TypeORM
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
// Dto
import { CreateRubricInput, UpdateRubricInput } from './dto';
// Entities
import { Rubric } from './entities/rubric.entity';
import { Criterion } from 'src/criterion/entities/criterion.entity';

@Injectable()
export class RubricService {
  constructor(
    @InjectRepository(Rubric)
    private rubricRepository: Repository<Rubric>,
    private readonly dataSource: DataSource
  ) {}

  async create(createRubricInput: CreateRubricInput): Promise<Rubric> {
    const { criteria, userId, ...rubricData } = createRubricInput;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Crear la rúbrica vinculando el userId
      const rubric = queryRunner.manager.create(Rubric, {
        ...rubricData,
        user: { id: userId } as any, // Asignamos el ID directamente a la relación
      });

      const savedRubric = await queryRunner.manager.save(rubric);

      // 2. Crear los criterios vinculados
      if (criteria && criteria.length > 0) {
        const criteriaToSave = criteria.map((c) =>
          queryRunner.manager.create(Criterion, {
            ...c,
            rubric: savedRubric,
          })
        );
        await queryRunner.manager.save(Criterion, criteriaToSave);
      }

      await queryRunner.commitTransaction();
      return this.findOne(savedRubric.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(): Promise<Rubric[]> {
    return await this.rubricRepository.find({ relations: ['users'] });
  }

  async findOne(id: string): Promise<Rubric> {
    return await this.rubricRepository.findOneOrFail({ where: { id }, relations: ['users'] });
  }

  async update(id: string, updateRubricInput: UpdateRubricInput): Promise<Rubric> {
    const { criteria, ...toUpdate } = updateRubricInput;

    // 1. Buscamos la rúbrica existente con sus criterios
    const rubric = await this.rubricRepository.findOne({
      where: { id },
      relations: ['criteria'],
    });

    if (!rubric) throw new NotFoundException(`Rubric with id ${id} not found`);

    // Iniciar transacción
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // 2. Actualizar datos básicos de la rúbrica
      await queryRunner.manager.update(Rubric, id, toUpdate);

      // 3. Si se enviaron criterios, gestionamos la actualización
      if (criteria) {
        // Opción recomendada: Eliminar criterios antiguos y crear los nuevos
        // (Esto simplifica mucho la lógica de los niveles JSONB)
        await queryRunner.manager.delete(Criterion, { rubric: { id } });

        const newCriteria = criteria.map((c) =>
          queryRunner.manager.create(Criterion, {
            ...c,
            rubric: { id },
          })
        );
        await queryRunner.manager.save(Criterion, newCriteria);
      }

      await queryRunner.commitTransaction();
      return this.findOne(id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async remove(id: string): Promise<Rubric> {
    const rubric = await this.findOne(id);
    await this.rubricRepository.remove(rubric);
    return { ...rubric, id };
  }
}
