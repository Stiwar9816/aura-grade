import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCriterionInput, UpdateCriterionInput } from './dto';
import { Criterion } from './entities/criterion.entity';
import { Rubric } from 'src/rubric/entities/rubric.entity';
import { User } from 'src/user/entities/user.entity';
import { UserRoles } from 'src/auth/enums';

const CRITERION_RELATIONS = ['rubric', 'rubric.user'];

@Injectable()
export class CriterionService {
  constructor(
    @InjectRepository(Criterion)
    private readonly criterionRepository: Repository<Criterion>,
    @InjectRepository(Rubric)
    private readonly rubricRepository: Repository<Rubric>
  ) {}

  async create(input: CreateCriterionInput, teacher: User): Promise<Criterion> {
    this.assertTeacher(teacher);
    const { rubric: rubricId, ...criterionData } = input;
    const rubric = await this.findOwnedRubric(rubricId, teacher);
    const criterion = this.criterionRepository.create({
      ...criterionData,
      rubric,
    });
    return this.criterionRepository.save(criterion);
  }

  async findAll(actor: User): Promise<Criterion[]> {
    const where = actor.isPlatformAdmin
      ? undefined
      : actor.role === UserRoles.Docente
        ? { rubric: { user: { id: actor.id } } }
        : { rubric: { user: { institutionId: actor.institutionId } } };
    return this.criterionRepository.find({
      where,
      relations: CRITERION_RELATIONS,
    });
  }

  async findOne(id: string, actor: User): Promise<Criterion> {
    const criterion = await this.criterionRepository.findOne({
      where: { id },
      relations: CRITERION_RELATIONS,
    });
    if (!criterion)
      throw new NotFoundException(`No se encontró el criterio con identificador ${id}.`);

    const canAccess =
      actor.isPlatformAdmin ||
      (actor.role === UserRoles.Docente && criterion.rubric?.user?.id === actor.id) ||
      (actor.role === UserRoles.Administrador &&
        criterion.rubric?.user?.institutionId === actor.institutionId);
    if (!canAccess) throw new ForbiddenException('No puedes acceder a este criterio.');
    return criterion;
  }

  async update(id: string, input: UpdateCriterionInput, teacher: User): Promise<Criterion> {
    this.assertTeacher(teacher);
    await this.findOne(id, teacher);
    const { id: _, ...toUpdate } = input;
    const criterion = await this.criterionRepository.preload({ id, ...toUpdate });
    if (!criterion)
      throw new NotFoundException(`No se encontró el criterio con identificador ${id}.`);
    return this.criterionRepository.save(criterion);
  }

  async remove(id: string, teacher: User): Promise<Criterion> {
    this.assertTeacher(teacher);
    const criterion = await this.findOne(id, teacher);
    await this.criterionRepository.remove(criterion);
    return { ...criterion, id };
  }

  private async findOwnedRubric(id: string, teacher: User): Promise<Rubric> {
    const rubric = await this.rubricRepository.findOne({
      where: { id, user: { id: teacher.id } },
      relations: ['user'],
    });
    if (!rubric)
      throw new ForbiddenException('La rúbrica no existe o no pertenece al docente actual.');
    return rubric;
  }

  private assertTeacher(actor: User): void {
    if (actor.role !== UserRoles.Docente)
      throw new ForbiddenException('Solo un docente puede administrar criterios.');
  }
}
