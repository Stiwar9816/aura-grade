import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCriterionInput, UpdateCriterionInput } from './dto';
import { Criterion } from './entities/criterion.entity';
import { Rubric } from 'src/rubric/entities/rubric.entity';
import { User } from 'src/user/entities/user.entity';
import { UserRoles } from 'src/auth/enums';
import { RUBRIC_LEVEL_RANGES, RUBRIC_MAX_SCORE } from 'src/rubric/rubric.constants';
import { RubricStatus } from 'src/rubric/enums';

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
      maxPoints: RUBRIC_MAX_SCORE,
      levels: this.normalizeLevels(criterionData.levels),
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
    const current = await this.findOne(id, teacher);
    this.assertDraft(current.rubric);
    const { id: _, ...toUpdate } = input;
    const criterion = await this.criterionRepository.preload({
      id,
      ...toUpdate,
      maxPoints: RUBRIC_MAX_SCORE,
      ...(toUpdate.levels ? { levels: this.normalizeLevels(toUpdate.levels) } : {}),
    });
    if (!criterion)
      throw new NotFoundException(`No se encontró el criterio con identificador ${id}.`);
    return this.criterionRepository.save(criterion);
  }

  async remove(id: string, teacher: User): Promise<Criterion> {
    this.assertTeacher(teacher);
    const criterion = await this.findOne(id, teacher);
    this.assertDraft(criterion.rubric);
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
    this.assertDraft(rubric);
    return rubric;
  }

  private normalizeLevels(levels: CreateCriterionInput['levels']) {
    const byLabel = new Map(levels.map((level) => [level.label, level.description?.trim()]));
    if (byLabel.size !== RUBRIC_LEVEL_RANGES.length)
      throw new BadRequestException('Cada criterio debe incluir los cuatro niveles obligatorios.');
    return RUBRIC_LEVEL_RANGES.map((range) => {
      const description = byLabel.get(range.label);
      if (!description)
        throw new BadRequestException(`Falta la descripción del nivel ${range.label}.`);
      return { ...range, score: range.maxScore, description };
    });
  }

  private assertDraft(rubric: Rubric): void {
    if (rubric.status !== RubricStatus.DRAFT)
      throw new BadRequestException('Los criterios de una rúbrica publicada son inmutables.');
  }

  private assertTeacher(actor: User): void {
    if (actor.role !== UserRoles.Docente)
      throw new ForbiddenException('Solo un docente puede administrar criterios.');
  }
}
