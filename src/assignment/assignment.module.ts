import { Module, forwardRef } from '@nestjs/common';
// Services
import { AssignmentService } from './assignment.service';
// Resolvers
import { AssignmentResolver } from './assignment.resolver';
// TypeORM
import { TypeOrmModule } from '@nestjs/typeorm';
// Entities
import { Assignment } from './entities/assignment.entity';
// Modules
import { UserModule } from 'src/user/user.module';
import { RubricModule } from 'src/rubric/rubric.module';
import { SubmissionModule } from 'src/submission/submission.module';

@Module({
  providers: [AssignmentResolver, AssignmentService],
  imports: [
    TypeOrmModule.forFeature([Assignment]),
    forwardRef(() => UserModule),
    forwardRef(() => RubricModule),
    forwardRef(() => SubmissionModule),
  ],
  exports: [AssignmentService, TypeOrmModule],
})
export class AssignmentModule {}
