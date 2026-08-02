import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { User } from '../user/entities/user.entity';
import { CreateInstitutionDto, UpdateInstitutionDto } from './dto';
import { Institution } from './entities/institution.entity';

@Injectable()
export class InstitutionService {
  constructor(
    @InjectRepository(Institution)
    private readonly institutionRepository: Repository<Institution>
  ) {}

  findActive(): Promise<Institution[]> {
    return this.institutionRepository.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  findAll(administrator: User): Promise<Institution[]> {
    this.assertPlatformAdministrator(administrator);
    return this.institutionRepository.find({
      order: { name: 'ASC' },
    });
  }

  async create(input: CreateInstitutionDto, administrator: User): Promise<Institution> {
    this.assertPlatformAdministrator(administrator);
    const institution = this.institutionRepository.create(this.normalize(input));

    try {
      return await this.institutionRepository.save(institution);
    } catch (error) {
      this.handlePersistenceError(error);
    }
  }

  async update(id: string, input: UpdateInstitutionDto, administrator: User): Promise<Institution> {
    this.assertPlatformAdministrator(administrator);
    if (id === administrator.institutionId && input.isActive === false) {
      throw new BadRequestException(
        'No puedes desactivar la institución asociada a tu sesión administrativa.'
      );
    }

    const normalized = this.normalize(input);
    const institution = await this.institutionRepository.preload({ id, ...normalized });
    if (!institution) throw new NotFoundException('La institución no existe.');

    try {
      return await this.institutionRepository.save(institution);
    } catch (error) {
      this.handlePersistenceError(error);
    }
  }

  async findActiveById(id: string): Promise<Institution> {
    const institution = await this.institutionRepository.findOne({
      where: { id, isActive: true },
    });

    if (!institution) {
      throw new NotFoundException('La institución seleccionada no está disponible.');
    }

    return institution;
  }

  private normalize<T extends CreateInstitutionDto | UpdateInstitutionDto>(input: T): T {
    const normalized = { ...input } as Record<string, unknown>;
    for (const [key, value] of Object.entries(normalized)) {
      if (typeof value === 'string') normalized[key] = value.trim();
    }
    if (typeof normalized.contactEmail === 'string') {
      normalized.contactEmail = normalized.contactEmail.toLowerCase();
    }
    return normalized as T;
  }

  private handlePersistenceError(error: unknown): never {
    if ((error as { code?: string })?.code === '23505') {
      throw new ConflictException('Ya existe una institución con esa identificación.');
    }
    throw error;
  }

  private assertPlatformAdministrator(administrator: User): void {
    if (!administrator.isPlatformAdmin) {
      throw new ForbiddenException(
        'Esta operación requiere permisos de administrador de plataforma.'
      );
    }
  }
}
