import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateInstitutionDto } from './create-institution.dto';

export class UpdateInstitutionDto extends PartialType(CreateInstitutionDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
