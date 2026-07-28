import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

  async findActiveById(id: string): Promise<Institution> {
    const institution = await this.institutionRepository.findOne({
      where: { id, isActive: true },
    });

    if (!institution) {
      throw new NotFoundException('La institución seleccionada no está disponible.');
    }

    return institution;
  }
}
