import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  CreateRubricInput,
  GenerateRubricInput,
  SaveRubricCriterionInput,
  SaveRubricDraftInput,
  UpdateRubricInput,
} from './dto';
import { Rubric } from './entities/rubric.entity';
import { User } from 'src/user/entities/user.entity';
import { UserRoles } from 'src/auth/enums';
import { Criterion } from 'src/criterion/entities/criterion.entity';
import { AiService } from 'src/ai/ai.service';
import { RUBRIC_LEVEL_RANGES, RUBRIC_MAX_SCORE, RUBRIC_WEIGHT_TOTAL } from './rubric.constants';
import { RubricSource, RubricStatus } from './enums';

const RUBRIC_RELATIONS = ['user', 'criteria'];

@Injectable()
export class RubricService {
  private readonly logger = new Logger(RubricService.name);

  constructor(
    @InjectRepository(Rubric)
    private readonly rubricRepository: Repository<Rubric>,
    private readonly dataSource: DataSource,
    private readonly aiService: AiService
  ) {}

  async create(input: CreateRubricInput, teacher: User): Promise<Rubric> {
    this.assertTeacher(teacher);
    const rubric = this.rubricRepository.create({
      ...input,
      maxTotalScore: RUBRIC_MAX_SCORE,
      status: RubricStatus.DRAFT,
      source: RubricSource.MANUAL,
      user: teacher,
    });
    const savedRubric = await this.rubricRepository.save(rubric);
    return this.findOne(savedRubric.id, teacher);
  }

  async generateDraft(input: GenerateRubricInput, teacher: User) {
    this.assertTeacher(teacher);
    return this.aiService.generateRubricDraft(input, teacher.id);
  }

  async saveDraft(input: SaveRubricDraftInput, teacher: User): Promise<Rubric> {
    this.assertTeacher(teacher);
    const normalizedCriteria = this.validateAndNormalizeCriteria(input.criteria);
    const aiMetadata = input.generationToken
      ? await this.aiService.verifyRubricGeneration(input.generationToken, teacher.id)
      : undefined;

    const savedId = await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Rubric);
      const criteriaRepository = manager.getRepository(Criterion);
      const current = input.id
        ? await repository
            .createQueryBuilder('rubric')
            .innerJoinAndSelect('rubric.user', 'user', 'user.id = :teacherId', {
              teacherId: teacher.id,
            })
            .where('rubric.id = :rubricId', { rubricId: input.id })
            .setLock('pessimistic_write')
            .getOne()
        : undefined;
      if (input.id && !current)
        throw new NotFoundException('La rúbrica no existe o no pertenece al docente actual.');

      let nextVersion: number | undefined;
      if (current && current.status !== RubricStatus.DRAFT) {
        const rootRubricId = current.rootRubricId ?? current.id;
        const lineage = await repository.find({
          where: [{ rootRubricId }, { id: rootRubricId }],
        });
        const existingDraft = lineage.find((version) => version.status === RubricStatus.DRAFT);
        if (existingDraft)
          throw new ConflictException(
            `La rúbrica ya tiene un borrador en la versión ${existingDraft.version}. Edítalo antes de crear otra versión.`
          );
        nextVersion = Math.max(...lineage.map((version) => version.version), current.version) + 1;
      }

      const rubric = this.prepareDraftVersion(
        repository,
        current,
        input,
        teacher,
        aiMetadata,
        nextVersion
      );
      const savedRubric = await repository.save(rubric);
      if (!savedRubric.rootRubricId) {
        savedRubric.rootRubricId = savedRubric.id;
        await repository.save(savedRubric);
      }

      if (current?.status === RubricStatus.DRAFT)
        await criteriaRepository.delete({ rubric: { id: current.id } });

      await criteriaRepository.save(
        normalizedCriteria.map((criterion, index) =>
          criteriaRepository.create({
            title: criterion.title.trim(),
            description: criterion.description.trim(),
            maxPoints: RUBRIC_MAX_SCORE,
            weight: criterion.weight,
            sortOrder: index,
            levels: criterion.levels,
            rubric: savedRubric,
          })
        )
      );
      return savedRubric.id;
    });

    if (input.generationToken) {
      try {
        await this.aiService.consumeRubricGeneration(input.generationToken);
      } catch (error) {
        this.logger.warn(
          `La rúbrica ${savedId} se guardó, pero no se pudo consumir el token de generación: ${
            error instanceof Error ? error.message : 'error desconocido'
          }`
        );
      }
    }
    return this.findOne(savedId, teacher);
  }

  async findAll(actor: User): Promise<Rubric[]> {
    const where = actor.isPlatformAdmin
      ? undefined
      : actor.role === UserRoles.Docente
        ? { user: { id: actor.id } }
        : { user: { institutionId: actor.institutionId } };

    const rubrics = await this.rubricRepository.find({
      where,
      relations: RUBRIC_RELATIONS,
      order: { updatedAt: 'DESC' },
    });
    return rubrics.map((rubric) => this.sortCriteria(rubric));
  }

  async findOne(id: string, actor: User): Promise<Rubric> {
    const rubric = await this.rubricRepository.findOne({
      where: { id },
      relations: RUBRIC_RELATIONS,
    });
    if (!rubric) throw new NotFoundException(`No se encontró la rúbrica con identificador ${id}.`);

    const canAccess =
      actor.isPlatformAdmin ||
      (actor.role === UserRoles.Docente && rubric.user?.id === actor.id) ||
      (actor.role === UserRoles.Administrador &&
        rubric.user?.institutionId === actor.institutionId);
    if (!canAccess) throw new ForbiddenException('No puedes acceder a esta rúbrica.');
    return this.sortCriteria(rubric);
  }

  async update(id: string, input: UpdateRubricInput, teacher: User): Promise<Rubric> {
    this.assertTeacher(teacher);
    const current = await this.findOne(id, teacher);
    this.assertMutable(current);
    const { id: _, maxTotalScore: __, ...toUpdate } = input;
    const rubric = await this.rubricRepository.preload({
      id,
      ...toUpdate,
      maxTotalScore: RUBRIC_MAX_SCORE,
    });
    if (!rubric) throw new NotFoundException(`No se encontró la rúbrica con identificador ${id}.`);
    await this.rubricRepository.save(rubric);
    return this.findOne(id, teacher);
  }

  async publishForAssignment(id: string, teacher: User): Promise<Rubric> {
    this.assertTeacher(teacher);
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Rubric);
      const criteriaRepository = manager.getRepository(Criterion);
      const rubric = await repository
        .createQueryBuilder('rubric')
        .innerJoinAndSelect('rubric.user', 'user', 'user.id = :teacherId', {
          teacherId: teacher.id,
        })
        .where('rubric.id = :rubricId', { rubricId: id })
        .setLock('pessimistic_write')
        .getOne();
      if (!rubric)
        throw new ForbiddenException('La rúbrica no existe o no pertenece al docente actual.');
      if (rubric.status === RubricStatus.ARCHIVED)
        throw new BadRequestException('No se puede asociar una rúbrica archivada.');
      rubric.criteria = await criteriaRepository.find({
        where: { rubric: { id: rubric.id } },
        order: { sortOrder: 'ASC' },
      });
      this.validateStoredCriteria(rubric.criteria ?? []);
      if (rubric.status === RubricStatus.DRAFT) {
        rubric.status = RubricStatus.PUBLISHED;
        rubric.publishedAt = new Date();
        await repository.save(rubric);
      }
      return this.sortCriteria(rubric);
    });
  }

  async remove(id: string, teacher: User): Promise<Rubric> {
    this.assertTeacher(teacher);
    const rubric = await this.findOne(id, teacher);
    if (rubric.status === RubricStatus.DRAFT) {
      await this.rubricRepository.remove(rubric);
      return { ...rubric, id };
    }
    rubric.status = RubricStatus.ARCHIVED;
    return this.rubricRepository.save(rubric);
  }

  private prepareDraftVersion(
    repository: Repository<Rubric>,
    current: Rubric | undefined,
    input: SaveRubricDraftInput,
    teacher: User,
    aiMetadata?: { model: string; promptVersion: string },
    nextVersion?: number
  ): Rubric {
    const common = {
      title: input.title.trim(),
      description: input.description.trim(),
      academicLevel: input.academicLevel,
      maxTotalScore: RUBRIC_MAX_SCORE,
      status: RubricStatus.DRAFT,
      source: aiMetadata ? RubricSource.AI : RubricSource.MANUAL,
      aiModel: aiMetadata?.model,
      promptVersion: aiMetadata?.promptVersion,
      user: teacher,
    };
    if (!current) return repository.create(common);
    if (current.status === RubricStatus.DRAFT) {
      Object.assign(current, common, {
        source: aiMetadata ? RubricSource.AI : current.source,
        aiModel: aiMetadata?.model ?? current.aiModel,
        promptVersion: aiMetadata?.promptVersion ?? current.promptVersion,
      });
      return current;
    }
    return repository.create({
      ...common,
      version: nextVersion ?? current.version + 1,
      rootRubricId: current.rootRubricId ?? current.id,
      previousVersionId: current.id,
    });
  }

  private validateAndNormalizeCriteria(criteria: SaveRubricCriterionInput[]) {
    const titles = new Set<string>();
    const normalized = criteria.map((criterion, index) => {
      const title = criterion.title.trim();
      const key = title.toLocaleLowerCase('es');
      if (titles.has(key)) throw new BadRequestException(`El criterio “${title}” está duplicado.`);
      titles.add(key);
      const weight = Number(criterion.weight);
      if (!Number.isFinite(weight) || weight <= 0 || weight > RUBRIC_WEIGHT_TOTAL)
        throw new BadRequestException(`El porcentaje del criterio ${index + 1} no es válido.`);

      const byLabel = new Map(criterion.levels.map((level) => [level.label, level.description]));
      if (byLabel.size !== RUBRIC_LEVEL_RANGES.length)
        throw new BadRequestException(
          `El criterio “${title}” debe contener los cuatro niveles sin duplicados.`
        );
      const levels = RUBRIC_LEVEL_RANGES.map((range) => {
        const description = byLabel.get(range.label)?.trim();
        if (!description)
          throw new BadRequestException(
            `Falta el descriptor ${range.label} del criterio “${title}”.`
          );
        return { ...range, score: range.maxScore, description };
      });
      return {
        ...criterion,
        title,
        weight: Number(weight.toFixed(2)),
        levels,
      };
    });

    const total = Number(
      normalized.reduce((sum, criterion) => sum + criterion.weight, 0).toFixed(2)
    );
    if (total !== RUBRIC_WEIGHT_TOTAL)
      throw new BadRequestException(
        `Los porcentajes deben sumar 100%. Actualmente suman ${total}%.`
      );
    return normalized;
  }

  private validateStoredCriteria(criteria: Criterion[]): void {
    if (!criteria.length)
      throw new BadRequestException('La rúbrica debe tener al menos un criterio para publicarse.');
    const total = Number(
      criteria.reduce((sum, criterion) => sum + Number(criterion.weight), 0).toFixed(2)
    );
    if (total !== RUBRIC_WEIGHT_TOTAL)
      throw new BadRequestException(
        `Los porcentajes de la rúbrica deben sumar 100%. Suman ${total}%.`
      );
  }

  private assertMutable(rubric: Rubric): void {
    if (rubric.status !== RubricStatus.DRAFT)
      throw new BadRequestException(
        'La rúbrica publicada es inmutable. Guarda los cambios para crear una nueva versión.'
      );
  }

  private sortCriteria(rubric: Rubric): Rubric {
    return {
      ...rubric,
      criteria: [...(rubric.criteria ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    } as Rubric;
  }

  private assertTeacher(actor: User): void {
    if (actor.role !== UserRoles.Docente)
      throw new ForbiddenException('Solo un docente puede administrar rúbricas.');
  }
}
