// NestJS
import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
// Services
import { SubmissionService } from './submission.service';
import { SubmissionProcessor } from './submission.processor';
// Resolvers
import { SubmissionResolver } from './submission.resolver';
// TypeORM
import { TypeOrmModule } from '@nestjs/typeorm';
// Entities
import { Submission } from './entities/submission.entity';
// Modules
import { AssignmentModule } from 'src/assignment/assignment.module';
import { UserModule } from 'src/user/user.module';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';
import { EvaluationModule } from 'src/evaluation/evaluation.module';
import { ExtractorModule } from 'src/extractor/extractor.module';
import { AiModule } from 'src/ai/ai.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  providers: [SubmissionResolver, SubmissionService, SubmissionProcessor],
  imports: [
    TypeOrmModule.forFeature([Submission]),
    BullModule.registerQueue({
      name: 'grading',
    }),
    forwardRef(() => UserModule),
    forwardRef(() => AssignmentModule),
    forwardRef(() => EvaluationModule),
    CloudinaryModule,
    ExtractorModule,
    AiModule,
    NotificationsModule,
    ConfigModule,
  ],
  exports: [SubmissionService, TypeOrmModule],
})
export class SubmissionModule {}
