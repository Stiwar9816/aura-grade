import { Module } from '@nestjs/common';
// Services
import { RubricService } from './rubric.service';
// Resolvers
import { RubricResolver } from './rubric.resolver';
// TypeORM
import { TypeOrmModule } from '@nestjs/typeorm';
// Entities
import { Rubric } from './entities/rubric.entity';
import { Criterion } from 'src/criterion/entities/criterion.entity';
import { AiModule } from 'src/ai/ai.module';
@Module({
  providers: [RubricResolver, RubricService],
  imports: [TypeOrmModule.forFeature([Rubric, Criterion]), AiModule],
  exports: [RubricService],
})
export class RubricModule {}
