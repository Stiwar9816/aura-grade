import { Controller, HttpCode, Param, ParseUUIDPipe, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from 'src/auth/decorators';
import { UserRoles } from 'src/auth/enums';
import { JwtAuthGuard } from 'src/auth/guards';
import { User } from 'src/user/entities/user.entity';
import { SgaGradesFile, SgaGradesService } from './sga-grades.service';

/** POST on purpose: mutating requests are audited, so every grade export leaves a record. */
@Controller('assignments')
@UseGuards(JwtAuthGuard)
export class SgaGradesController {
  constructor(private readonly grades: SgaGradesService) {}

  @Post(':assignmentId/sga-grades')
  @HttpCode(200)
  async download(
    @CurrentUser([UserRoles.Docente]) actor: User,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Res({ passthrough: true }) response: Response
  ): Promise<SgaGradesFile> {
    const file = await this.grades.build(assignmentId, actor);
    response.set({
      'Content-Disposition': `attachment; filename="aura-grade-sga-${assignmentId.slice(0, 8)}.json"`,
      'Cache-Control': 'no-store',
    });
    return file;
  }
}
