import { Module, forwardRef } from '@nestjs/common';
// Services
import { AssignmentService } from './assignment.service';
import { SgaGradesController } from './sga-grades.controller';
import { SgaGradesService } from './sga-grades.service';
// Resolvers
import { AssignmentResolver } from './assignment.resolver';
// TypeORM
import { TypeOrmModule } from '@nestjs/typeorm';
// Entities
import { Assignment } from './entities/assignment.entity';
import { Course } from 'src/course/entities/course.entity';
import { Rubric } from 'src/rubric/entities/rubric.entity';
import { AssignmentExtension } from './entities/assignment-extension.entity';
// Modules
import { UserModule } from 'src/user/user.module';
import { RubricModule } from 'src/rubric/rubric.module';
import { SubmissionModule } from 'src/submission/submission.module';

@Module({
  controllers: [SgaGradesController],
  providers: [AssignmentResolver, AssignmentService, SgaGradesService],
  imports: [
    TypeOrmModule.forFeature([Assignment, AssignmentExtension, Course, Rubric]),
    forwardRef(() => UserModule),
    forwardRef(() => RubricModule),
    forwardRef(() => SubmissionModule),
  ],
  exports: [AssignmentService, TypeOrmModule],
})
export class AssignmentModule {}
