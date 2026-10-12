import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeedbackEntry } from '../feedback/entities/feedback-entry.entity';
import { Submission } from '../submission/entities/submission.entity';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Submission, FeedbackEntry]),
    BullModule.registerQueue({ name: 'grading' }, { name: 'notifications' }),
  ],
  controllers: [OperationsController],
  providers: [OperationsService],
})
export class OperationsModule {}
