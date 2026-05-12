import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Evaluation } from 'src/evaluation/entities/evaluation.entity';
import { ReEvaluationRequest } from './entities/reevaluation-request.entity';
import { ReEvaluationResolver } from './reevaluation.resolver';
import { ReEvaluationService } from './reevaluation.service';

@Module({
  imports: [TypeOrmModule.forFeature([ReEvaluationRequest, Evaluation])],
  providers: [ReEvaluationResolver, ReEvaluationService],
  exports: [ReEvaluationService],
})
export class ReEvaluationModule {}
