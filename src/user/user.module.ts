// NestJS
import { forwardRef, Module } from '@nestjs/common';
// Passport
import { PassportModule } from '@nestjs/passport';
// TypeORM
import { TypeOrmModule } from '@nestjs/typeorm';
// Resolvers
import { UserResolver } from './user.resolver';
// Serivces
import { UserService } from './user.service';
// Entities
import { User } from './entities/user.entity';
// Modules
import { AuthModule } from 'src/auth/auth.module';
import { CourseModule } from 'src/course/course.module';
import { RubricModule } from 'src/rubric/rubric.module';
import { AssignmentModule } from 'src/assignment/assignment.module';

@Module({
  providers: [UserResolver, UserService],
  imports: [
    TypeOrmModule.forFeature([User]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    forwardRef(() => AuthModule),
    forwardRef(() => CourseModule),
    forwardRef(() => RubricModule),
    forwardRef(() => AssignmentModule),
  ],
  exports: [UserService, TypeOrmModule],
})
export class UserModule {}
