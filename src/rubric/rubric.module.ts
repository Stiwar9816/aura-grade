import { Module, forwardRef } from '@nestjs/common';
// Services
import { RubricService } from './rubric.service';
// Resolvers
import { RubricResolver } from './rubric.resolver';
// TypeORM
import { TypeOrmModule } from '@nestjs/typeorm';
// Entities
import { Rubric } from './entities/rubric.entity';
// Modules
import { UserModule } from 'src/user/user.module';
import { CriterionModule } from 'src/criterion/criterion.module';
import { AssignmentModule } from 'src/assignment/assignment.module';

@Module({
  providers: [RubricResolver, RubricService],
  imports: [
    TypeOrmModule.forFeature([Rubric]),
    forwardRef(() => UserModule),
    forwardRef(() => CriterionModule),
    forwardRef(() => AssignmentModule),
  ],
  exports: [RubricService],
})
export class RubricModule {}
