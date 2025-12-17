import { Module } from '@nestjs/common';
// Services
import { SeedService } from './seed.service';
// Resolvers
import { SeedResolver } from './seed.resolver';
// TypeORM
import { TypeOrmModule } from '@nestjs/typeorm';
// Entities
import { User } from 'src/user/entities/user.entity';
import { Rubric } from 'src/rubric/entities/rubric.entity';
import { Assignment } from 'src/assignment/entities/assignment.entity';
import { Submission } from 'src/submission/entities/submission.entity';
import { Evaluation } from 'src/evaluation/entities/evaluation.entity';

@Module({
  providers: [SeedService, SeedResolver],
  imports: [TypeOrmModule.forFeature([User, Rubric, Assignment, Submission, Evaluation])],
})
export class SeedModule {}
