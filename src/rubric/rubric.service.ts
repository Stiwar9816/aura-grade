import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateRubricInput, UpdateRubricInput } from './dto';
import { Rubric } from './entities/rubric.entity';
import { User } from 'src/user/entities/user.entity';
import { UserRoles } from 'src/auth/enums';

const RUBRIC_RELATIONS = ['user', 'criteria'];

@Injectable()
export class RubricService {
  constructor(
    @InjectRepository(Rubric)
    private readonly rubricRepository: Repository<Rubric>
  ) {}

  async create(input: CreateRubricInput, teacher: User): Promise<Rubric> {
    this.assertTeacher(teacher);
    const rubric = this.rubricRepository.create({
      ...input,
      user: teacher,
    });
    const savedRubric = await this.rubricRepository.save(rubric);
    return this.findOne(savedRubric.id, teacher);
  }

  async findAll(actor: User): Promise<Rubric[]> {
    const where = actor.isPlatformAdmin
      ? undefined
      : actor.role === UserRoles.Docente
        ? { user: { id: actor.id } }
        : { user: { institutionId: actor.institutionId } };

    return this.rubricRepository.find({
      where,
      relations: RUBRIC_RELATIONS,
    });
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
    return rubric;
  }

  async update(id: string, input: UpdateRubricInput, teacher: User): Promise<Rubric> {
    this.assertTeacher(teacher);
    await this.findOne(id, teacher);
    const { id: _, ...toUpdate } = input;
    const rubric = await this.rubricRepository.preload({ id, ...toUpdate });
    if (!rubric) throw new NotFoundException(`No se encontró la rúbrica con identificador ${id}.`);
    return this.rubricRepository.save(rubric);
  }

  async remove(id: string, teacher: User): Promise<Rubric> {
    this.assertTeacher(teacher);
    const rubric = await this.findOne(id, teacher);
    await this.rubricRepository.remove(rubric);
    return { ...rubric, id };
  }

  private assertTeacher(actor: User): void {
    if (actor.role !== UserRoles.Docente)
      throw new ForbiddenException('Solo un docente puede administrar rúbricas.');
  }
}
