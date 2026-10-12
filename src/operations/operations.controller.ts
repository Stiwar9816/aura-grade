import { Controller, Get, Header, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators';
import { UserRoles } from '../auth/enums';
import { JwtAuthGuard } from '../auth/guards';
import type { User } from '../user/entities/user.entity';
import { OperationsService } from './operations.service';

@Controller('operations')
@UseGuards(JwtAuthGuard)
export class OperationsController {
  constructor(private readonly operationsService: OperationsService) {}

  @Get('summary')
  @Header('Cache-Control', 'no-store')
  summary(@CurrentUser([UserRoles.Administrador]) administrator: User) {
    return this.operationsService.summary(administrator);
  }

  @Post('submissions/:id/retry')
  @Throttle({ short: { limit: 10, ttl: 60 * 1000 } })
  retrySubmission(
    @CurrentUser([UserRoles.Administrador]) administrator: User,
    @Param('id', new ParseUUIDPipe()) id: string
  ) {
    return this.operationsService.retrySubmission(administrator, id);
  }
}
