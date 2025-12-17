import { Module, forwardRef } from '@nestjs/common';
// TypeORM
import { TypeOrmModule } from '@nestjs/typeorm';
// Resolvers
import { CriterionResolver } from './criterion.resolver';
// Services
import { CriterionService } from './criterion.service';
// Entities
import { Criterion } from './entities/criterion.entity';
// Modules
import { RubricModule } from 'src/rubric/rubric.module';

@Module({
  providers: [CriterionResolver, CriterionService],
  imports: [TypeOrmModule.forFeature([Criterion]), forwardRef(() => RubricModule)],
  exports: [CriterionService],
})
export class CriterionModule {}
