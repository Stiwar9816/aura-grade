import { Module, forwardRef } from '@nestjs/common';
import { EvaluationService } from './evaluation.service';
import { EvaluationResolver } from './evaluation.resolver';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Evaluation } from './entities/evaluation.entity';
import { SubmissionModule } from 'src/submission/submission.module';

@Module({
  providers: [EvaluationResolver, EvaluationService],
  imports: [TypeOrmModule.forFeature([Evaluation]), forwardRef(() => SubmissionModule)],
  exports: [EvaluationService],
})
export class EvaluationModule {}
