import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators';
import { UserRoles } from '../auth/enums';
import { JwtAuthGuard } from '../auth/guards';
import type { User } from '../user/entities/user.entity';
import { CreateInstitutionDto, UpdateInstitutionDto } from './dto';
import { InstitutionService } from './institution.service';

@Controller('institutions')
export class InstitutionController {
  constructor(private readonly institutionService: InstitutionService) {}

  @Get('public')
  findActive() {
    return this.institutionService.findActive();
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@CurrentUser([UserRoles.Administrador]) administrator: User) {
    return this.institutionService.findAll(administrator);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Body() input: CreateInstitutionDto,
    @CurrentUser([UserRoles.Administrador]) administrator: User
  ) {
    return this.institutionService.create(input, administrator);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateInstitutionDto,
    @CurrentUser([UserRoles.Administrador]) administrator: User
  ) {
    return this.institutionService.update(id, input, administrator);
  }
}
