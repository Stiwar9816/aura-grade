import { Module } from '@nestjs/common';
import { CourseService } from './course.service';
import { CourseResolver } from './course.resolver';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Course } from './entities/course.entity';
import { UserModule } from 'src/user/user.module';
import { forwardRef } from '@nestjs/common';

@Module({
  providers: [CourseResolver, CourseService],
  imports: [TypeOrmModule.forFeature([Course]), forwardRef(() => UserModule)],
  exports: [CourseService, TypeOrmModule],
})
export class CourseModule {}
