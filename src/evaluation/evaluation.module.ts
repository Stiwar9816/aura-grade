import { Module, forwardRef } from '@nestjs/common';
import { EvaluationService } from './evaluation.service';
import { EvaluationResolver } from './evaluation.resolver';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Evaluation } from './entities/evaluation.entity';
import { SubmissionModule } from 'src/submission/submission.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { BullModule } from '@nestjs/bullmq';
import { TrainingExportController } from './training-export.controller';
import { TrainingExportService } from './training-export.service';
import { GradingHistoryService } from './grading-history.service';
import { GradingInsightsService } from './grading-insights.service';
import { GradingMemoryService } from './grading-memory.service';

@Module({
  controllers: [TrainingExportController],
  providers: [
    EvaluationResolver,
    EvaluationService,
    GradingHistoryService,
    GradingInsightsService,
    GradingMemoryService,
    TrainingExportService,
  ],
  imports: [
    TypeOrmModule.forFeature([Evaluation]),
    BullModule.registerQueue({ name: 'grading' }),
    NotificationsModule,
    forwardRef(() => SubmissionModule),
  ],
  exports: [EvaluationService, GradingMemoryService],
})
export class EvaluationModule {}
