import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';

import { SEED_DATA } from './data/seed-data';
import { Rubric } from 'src/rubric/entities/rubric.entity';
import { Assignment } from 'src/assignment/entities/assignment.entity';
import { User } from 'src/user/entities/user.entity';
import { Course } from 'src/course/entities/course.entity';
import { Institution, InstitutionApprovalStatus } from 'src/institution';

@Injectable()
export class SeedService {
  private readonly logger = new Logger('SeedService');

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService
  ) {}

  async executeSeed(): Promise<string> {
    if (this.configService.get<string>('STATE') !== 'dev') {
      throw new ForbiddenException(
        'La carga de datos iniciales solo está disponible en desarrollo.'
      );
    }

    const passwordHashes = this.hashSeedPasswords();

    try {
      await this.dataSource.transaction(async (manager) => {
        // Every application record is downstream from an institution. CASCADE also clears
        // course enrollments, submissions, evaluations and re-evaluation requests.
        await manager.query('TRUNCATE TABLE "institutions" RESTART IDENTITY CASCADE');

        const institutionRepository = manager.getRepository(Institution);
        const userRepository = manager.getRepository(User);
        const rubricRepository = manager.getRepository(Rubric);
        const courseRepository = manager.getRepository(Course);
        const assignmentRepository = manager.getRepository(Assignment);

        const institutionSeeds = SEED_DATA.institutions;
        const institutions = await institutionRepository.save(
          institutionSeeds.map(({ key: _key, ...institution }) => institution)
        );
        const institutionsByKey = new Map(
          institutions.map((institution, index) => [institutionSeeds[index].key, institution])
        );

        const users = await userRepository.save(
          SEED_DATA.users.map(({ institutionKey, password, approvalStatus, ...user }) => {
            const institution = this.requireReference(
              institutionsByKey,
              institutionKey,
              'institution'
            );
            return {
              ...user,
              password: this.requireReference(passwordHashes, password, 'password hash'),
              institutionId: institution.id,
              institution,
              approvalStatus: approvalStatus ?? InstitutionApprovalStatus.APPROVED,
            };
          })
        );
        const usersByEmail = new Map(users.map((user) => [user.email, user]));

        const rubrics = await rubricRepository.save(
          SEED_DATA.rubrics.map(({ ownerEmail, ...rubric }) => ({
            ...rubric,
            user: this.requireReference(usersByEmail, ownerEmail, 'rubric owner'),
          }))
        );
        const rubricsByTitle = new Map(rubrics.map((rubric) => [rubric.title, rubric]));

        const courses = await courseRepository.save(
          SEED_DATA.courses.map(({ teacherEmail, studentEmails, ...course }) => ({
            ...course,
            user: this.requireReference(usersByEmail, teacherEmail, 'course teacher'),
            users: studentEmails.map((email) =>
              this.requireReference(usersByEmail, email, 'course student')
            ),
          }))
        );
        const coursesByCode = new Map(courses.map((course) => [course.code_course, course]));

        await assignmentRepository.save(
          SEED_DATA.assignments.map(
            ({ teacherEmail, courseCode, rubricTitle, dueInDays, ...assignment }) => ({
              ...assignment,
              dueDate: new Date(Date.now() + dueInDays * 24 * 60 * 60 * 1000),
              user: this.requireReference(usersByEmail, teacherEmail, 'assignment teacher'),
              course: this.requireReference(coursesByCode, courseCode, 'assignment course'),
              rubric: this.requireReference(rubricsByTitle, rubricTitle, 'assignment rubric'),
            })
          )
        );
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error desconocido al cargar los datos iniciales.';
      this.logger.error(message);
      throw new InternalServerErrorException(message);
    }

    const summary = `Datos iniciales cargados correctamente: ${SEED_DATA.institutions.length} instituciones, ${SEED_DATA.users.length} usuarios, ${SEED_DATA.courses.length} cursos, ${SEED_DATA.rubrics.length} rúbricas y ${SEED_DATA.assignments.length} tareas.`;
    this.logger.log(summary);
    return summary;
  }

  private hashSeedPasswords(): Map<string, string> {
    const hashes = new Map<string, string>();

    for (const { password } of SEED_DATA.users) {
      if (!hashes.has(password)) hashes.set(password, bcrypt.hashSync(password, 12));
    }

    return hashes;
  }

  private requireReference<T>(references: Map<string, T>, key: string, label: string): T {
    const reference = references.get(key);
    if (!reference)
      throw new Error(`No se encontró la referencia de datos iniciales ${label} para «${key}».`);
    return reference;
  }
}
