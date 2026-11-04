import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { Course } from '../course/entities/course.entity';
import { AcademicAccessService } from './academic-access.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Course])],
  providers: [AcademicAccessService],
  exports: [AcademicAccessService],
})
export class AcademicAccessModule {}
