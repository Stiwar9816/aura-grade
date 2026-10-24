import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { Course } from '../course/entities/course.entity';
import { UserRoles } from '../auth/enums';
import { hasAcademicAccess } from './academic-access.policy';

export type StudentAccessContext = Readonly<{ studentId: string; institutionId: string }>;
export type StudentCourseAccessContext = StudentAccessContext & Readonly<{ courseId: string }>;

@Injectable()
export class AcademicAccessService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Course) private readonly courses: Repository<Course>
  ) {}

  /** userId must come from a verified session/link, never from student-supplied text. */
  async requireStudent(userId: string): Promise<StudentAccessContext> {
    if (typeof userId !== 'string' || !userId.trim()) throw this.denied();
    const user = await this.users.findOne({ where: { id: userId }, relations: ['institution'] });
    if (!hasAcademicAccess(user) || user.role !== UserRoles.Estudiante || !user.institutionId)
      throw this.denied();
    return { studentId: user.id, institutionId: user.institutionId };
  }

  async requireStudentCourse(
    userId: string,
    courseId: string
  ): Promise<StudentCourseAccessContext> {
    if (typeof courseId !== 'string' || !courseId.trim()) throw this.denied();
    const student = await this.requireStudent(userId);
    const enrolled = await this.courses.existsBy({
      id: courseId,
      users: { id: student.studentId },
      user: { institutionId: student.institutionId },
    });
    if (!enrolled) throw this.denied();
    return { ...student, courseId };
  }

  /** Call again when a queued task executes; do not persist/cache the returned authorization. */
  async runForStudentCourse<T>(
    userId: string,
    courseId: string,
    operation: (context: StudentCourseAccessContext) => Promise<T>
  ): Promise<T> {
    const context = await this.requireStudentCourse(userId, courseId);
    return operation(context);
  }

  private denied(): ForbiddenException {
    return new ForbiddenException({
      code: 'ACADEMIC_ACCESS_DENIED',
      message: 'No tienes acceso académico a esta consulta. Contacta con tu institución.',
    });
  }
}
