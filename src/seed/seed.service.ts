import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRoles } from 'src/auth/enums';

import { SEED_DATA } from './data/seed-data';
import { Rubric } from 'src/rubric/entities/rubric.entity';
import { Assignment } from 'src/assignment/entities/assignment.entity';
import { Submission } from 'src/submission/entities/submission.entity';
import { Evaluation } from 'src/evaluation/entities/evaluation.entity';
import { User } from 'src/user/entities/user.entity';

@Injectable()
export class SeedService {
  private readonly logger = new Logger('SeedService');

  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Rubric) private readonly rubricRepository: Repository<Rubric>,
    @InjectRepository(Assignment) private readonly assignmentRepository: Repository<Assignment>,
    @InjectRepository(Submission) private readonly submissionRepository: Repository<Submission>,
    @InjectRepository(Evaluation) private readonly evaluationRepository: Repository<Evaluation>
  ) {}

  async executeSeed() {
    try {
      // 1. Limpiar base de datos (Orden de integridad referencial)
      await this.deleteDatabase();

      // 2. Crear Usuarios (Docentes y Estudiantes)
      // Usamos insert o save. Save disparará los listeners de @BeforeInsert (como el hash de password)
      const users = await this.userRepository.save(SEED_DATA.users);
      const teacher = users.find((u) => u.role === UserRoles.Docente);

      if (!teacher) throw new Error('No teacher found in SEED_DATA');

      // 3. Crear Rúbricas de prueba
      const rubrics = await this.rubricRepository.save(SEED_DATA.rubrics);
      const essayRubric = rubrics.find((r) => r.title === 'Rúbrica de Ensayo Académico');
      const projectRubric = rubrics.find((r) => r.title === 'Rúbrica de Proyecto de Software');

      // 4. Crear Tareas (Assignment) vinculada al docente y la rúbrica
      await this.assignmentRepository.save([
        {
          title: 'Ensayo Final sobre NestJS',
          description: 'Escribir un ensayo argumentativo sobre las ventajas de NestJS.',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Vence en 7 días
          user: teacher, // La relación en la entidad es 'user', no 'teacher'
          rubric: essayRubric,
        },
        {
          title: 'API GraphQL con AuraGrade',
          description: 'Implementar el backend usando los principios del curso.',
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // Vence en 14 días
          user: teacher,
          rubric: projectRubric,
        },
      ]);
      this.logger.log('Seed executed successfully');
      return 'Seed executed successfully. Database is ready for AuraGrade testing.';
    } catch (error) {
      this.logger.error(error.message);
      throw new InternalServerErrorException(error.message);
    }
  }

  private async deleteDatabase() {
    // EL ORDEN ES CRÍTICO: De la tabla más dependiente (hijos) a la más independiente (padres)
    // EL ORDEN ES CRÍTICO: De la tabla más dependiente (hijos) a la más independiente (padres)
    // Usamos delete({}) para limpiar tablas completas sin borrar la estructura
    await this.evaluationRepository.createQueryBuilder().delete().execute();
    await this.submissionRepository.createQueryBuilder().delete().execute();
    await this.assignmentRepository.createQueryBuilder().delete().execute();
    await this.rubricRepository.createQueryBuilder().delete().execute();

    // Eliminación física de usuarios
    await this.userRepository.createQueryBuilder().delete().execute();
  }
}
