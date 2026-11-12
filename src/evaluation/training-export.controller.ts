import { Body, Controller, Get, HttpCode, Post, Query, Res, UseGuards } from '@nestjs/common';
import { IsBoolean, IsIn, IsOptional, IsUUID } from 'class-validator';
import type { Response } from 'express';
import { CurrentUser } from 'src/auth/decorators';
import { UserRoles } from 'src/auth/enums';
import { JwtAuthGuard } from 'src/auth/guards';
import { User } from 'src/user/entities/user.entity';
import { GradingInsightsService } from './grading-insights.service';
import { TrainingDataset, TrainingExportService } from './training-export.service';

export class TrainingExportDto {
  @IsIn(['evaluations', 'criteria', 'jsonl'])
  dataset: TrainingDataset;

  @IsOptional()
  @IsBoolean()
  includeSubmissionText?: boolean;

  @IsOptional()
  @IsUUID()
  courseId?: string;

  @IsOptional()
  @IsBoolean()
  redactPersonalData?: boolean;
}

export class GradingInsightsQueryDto {
  @IsOptional()
  @IsUUID()
  courseId?: string;
}

/** POST on purpose: mutating requests are audited, so every download leaves a record. */
@Controller('evaluations')
@UseGuards(JwtAuthGuard)
export class TrainingExportController {
  constructor(
    private readonly exports: TrainingExportService,
    private readonly insights: GradingInsightsService
  ) {}

  @Post('training-export')
  @HttpCode(200)
  async download(
    @CurrentUser([UserRoles.Administrador]) actor: User,
    @Body() body: TrainingExportDto,
    @Res({ passthrough: true }) response: Response
  ): Promise<string> {
    const { content, rows, contentType, extension } = await this.exports.export(
      actor,
      body.dataset,
      {
        includeSubmissionText: body.includeSubmissionText === true,
        courseId: body.courseId,
        redactPersonalData: body.redactPersonalData !== false,
      }
    );
    const date = new Date().toISOString().slice(0, 10);
    const name = body.dataset === 'jsonl' ? 'training' : body.dataset;
    response.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="aura-grade-${name}-${date}.${extension}"`,
      'Cache-Control': 'no-store',
      'X-Export-Rows': String(rows),
    });
    return content;
  }

  @Get('grading-insights')
  async gradingInsights(
    @CurrentUser([UserRoles.Administrador]) actor: User,
    @Query() query: GradingInsightsQueryDto,
    @Res({ passthrough: true }) response: Response
  ) {
    response.set('Cache-Control', 'no-store');
    return this.insights.summary(actor, query.courseId);
  }
}
