import {
  BadRequestException,
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators';
import { UserRoles } from '../auth/enums';
import { JwtAuthGuard } from '../auth/guards';
import type { User } from '../user/entities/user.entity';
import { AuditService } from './audit.service';
import { AuditOutcome } from './enums';

@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(
    @CurrentUser([UserRoles.Administrador]) administrator: User,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(25), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('action') action?: string,
    @Query('outcome') outcome?: string
  ) {
    const parsedOutcome = this.parseOutcome(outcome);
    return this.auditService.findForAdministrator(administrator, {
      page,
      limit,
      search,
      action,
      outcome: parsedOutcome,
    });
  }

  private parseOutcome(outcome?: string): AuditOutcome | undefined {
    if (!outcome) return undefined;
    if (Object.values(AuditOutcome).includes(outcome as AuditOutcome)) {
      return outcome as AuditOutcome;
    }
    throw new BadRequestException('El resultado de auditoría no es válido.');
  }
}
