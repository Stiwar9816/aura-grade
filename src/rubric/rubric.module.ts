import { Module } from '@nestjs/common';
// Services
import { RubricService } from './rubric.service';
// Resolvers
import { RubricResolver } from './rubric.resolver';
// TypeORM
import { TypeOrmModule } from '@nestjs/typeorm';
// Entities
import { Rubric } from './entities/rubric.entity';
@Module({
  providers: [RubricResolver, RubricService],
  imports: [TypeOrmModule.forFeature([Rubric])],
  exports: [RubricService],
})
export class RubricModule {}
