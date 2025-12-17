// NestJS
import { Module, forwardRef } from '@nestjs/common';
// Services
import { SubmissionService } from './submission.service';
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

@Module({
  providers: [SubmissionResolver, SubmissionService],
  imports: [
    TypeOrmModule.forFeature([Submission]),
    forwardRef(() => UserModule),
    forwardRef(() => AssignmentModule),
    forwardRef(() => EvaluationModule),
    CloudinaryModule,
    ExtractorModule,
  ],
  exports: [SubmissionService, TypeOrmModule],
})
export class SubmissionModule {}
