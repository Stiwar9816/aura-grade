import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';
import { FeedbackEntry } from './entities/feedback-entry.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FeedbackEntry])],
  controllers: [FeedbackController],
  providers: [FeedbackService],
  exports: [FeedbackService, TypeOrmModule],
})
export class FeedbackModule {}
