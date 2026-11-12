import { Body, Controller, HttpCode, Post, Res, UseGuards } from '@nestjs/common';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import type { Response } from 'express';
import { CurrentUser } from 'src/auth/decorators';
import { UserRoles } from 'src/auth/enums';
import { JwtAuthGuard } from 'src/auth/guards';
import { User } from 'src/user/entities/user.entity';
import { TrainingDataset, TrainingExportService } from './training-export.service';

export class TrainingExportDto {
  @IsIn(['evaluations', 'criteria'])
  dataset: TrainingDataset;

  @IsOptional()
  @IsBoolean()
  includeSubmissionText?: boolean;
}

/** POST on purpose: mutating requests are audited, so every download leaves a record. */
@Controller('evaluations/training-export')
@UseGuards(JwtAuthGuard)
export class TrainingExportController {
  constructor(private readonly exports: TrainingExportService) {}

  @Post()
  @HttpCode(200)
  async download(
    @CurrentUser([UserRoles.Administrador]) actor: User,
    @Body() body: TrainingExportDto,
    @Res({ passthrough: true }) response: Response
  ): Promise<string> {
    const { csv, rows } = await this.exports.export(
      actor,
      body.dataset,
      body.includeSubmissionText === true
    );
    const date = new Date().toISOString().slice(0, 10);
    response.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="aura-grade-${body.dataset}-${date}.csv"`,
      'Cache-Control': 'no-store',
      'X-Export-Rows': String(rows),
    });
    return csv;
  }
}
