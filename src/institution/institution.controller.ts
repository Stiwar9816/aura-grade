import { Controller, Get } from '@nestjs/common';
import { InstitutionService } from './institution.service';

@Controller('institutions')
export class InstitutionController {
  constructor(private readonly institutionService: InstitutionService) {}

  @Get('public')
  findActive() {
    return this.institutionService.findActive();
  }
}
