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
import { SubmissionModule } from 'src/submission/submission.module';
import { JwtModule } from '@nestjs/jwt';
import { UserImportService } from './import/user-import.service';
import { UserInvitationController } from './import/user-invitation.controller';
import { InstitutionModule } from 'src/institution';

@Module({
  controllers: [UserInvitationController],
  providers: [UserResolver, UserService, UserImportService],
  imports: [
    TypeOrmModule.forFeature([User]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule,
    InstitutionModule,
    forwardRef(() => AuthModule),
    forwardRef(() => CourseModule),
    forwardRef(() => RubricModule),
    forwardRef(() => AssignmentModule),
    forwardRef(() => SubmissionModule),
  ],
  exports: [UserService, UserImportService, TypeOrmModule],
})
export class UserModule {}
