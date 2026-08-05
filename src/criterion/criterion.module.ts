import { Module } from '@nestjs/common';
// TypeORM
import { TypeOrmModule } from '@nestjs/typeorm';
// Resolvers
import { CriterionResolver } from './criterion.resolver';
// Services
import { CriterionService } from './criterion.service';
// Entities
import { Criterion } from './entities/criterion.entity';
import { Rubric } from 'src/rubric/entities/rubric.entity';
@Module({
  providers: [CriterionResolver, CriterionService],
  imports: [TypeOrmModule.forFeature([Criterion, Rubric])],
  exports: [CriterionService],
})
export class CriterionModule {}
