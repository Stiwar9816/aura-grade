import { Module } from '@nestjs/common';
// Services
import { SeedService } from './seed.service';
// TypeORM
import { TypeOrmModule } from '@nestjs/typeorm';
// Entities
import { User } from 'src/user/entities/user.entity';
import { Rubric } from 'src/rubric/entities/rubric.entity';
import { Assignment } from 'src/assignment/entities/assignment.entity';
import { Submission } from 'src/submission/entities/submission.entity';
import { Evaluation } from 'src/evaluation/entities/evaluation.entity';
import { Course } from 'src/course/entities/course.entity';
import { Institution } from 'src/institution';

@Module({
  providers: [SeedService],
  imports: [
    TypeOrmModule.forFeature([
      User,
      Rubric,
      Assignment,
      Submission,
      Evaluation,
      Course,
      Institution,
    ]),
  ],
  exports: [SeedService],
})
export class SeedModule {}
