// NestJS
import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
// TypeORM
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
// Bcrypt
import * as bcrypt from 'bcryptjs';
// Dto
import {
  AssignCoursesInput,
  CreateUserInput,
  ReviewInstitutionUserInput,
  UpdateOwnProfileInput,
  UpdateUserInput,
} from './dto';
// Entities
import { User } from './entities/user.entity';
import { Course } from 'src/course/entities/course.entity';
// Services
import { MailService } from 'src/mail/mail.service';
import { AuthService } from 'src/auth/auth.service';
import { InstitutionApprovalStatus } from 'src/institution';
import { UserRoles } from 'src/auth/enums';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly mailService: MailService,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>
  ) {}
  async create(createUserInput: CreateUserInput): Promise<User> {
    const user = this.userRepository.create(createUserInput);
    // Encrypt password
    user.password = bcrypt.hashSync(user.password, 10);
    try {
      return await this.userRepository.save(user);
    } catch (error) {
      this.handleDBException(error);
    }
  }

  async findAll(user: User): Promise<User[]> {
    const allowedRoles = ['Estudiante', 'Docente', 'Administrador'];
    return this.userRepository.find({
      where: {
        role: In(allowedRoles),
        institutionId: user.institutionId,
      },
      relations: [
        'courses',
        'submissions',
        'submissions.evaluation',
        'submissions.assignment',
        'submissions.assignment.rubric',
      ],
    });
  }

  async findPendingInstitutionUsers(administrator: User): Promise<User[]> {
    if (administrator.role !== UserRoles.Administrador)
      throw new ForbiddenException('Solo un administrador puede revisar solicitudes de usuarios.');

    return this.userRepository.find({
      where: {
        institutionId: administrator.institutionId,
        approvalStatus: InstitutionApprovalStatus.PENDING,
        role: In([UserRoles.Estudiante, UserRoles.Docente]),
      },
      order: { name: 'ASC', last_name: 'ASC' },
    });
  }

  async reviewInstitutionUser(
    { userId, status }: ReviewInstitutionUserInput,
    administrator: User
  ): Promise<User> {
    if (administrator.role !== UserRoles.Administrador)
      throw new ForbiddenException('Solo un administrador puede revisar solicitudes de usuarios.');
    if (status === InstitutionApprovalStatus.PENDING)
      throw new BadRequestException('La revisión debe aprobar o rechazar la solicitud.');

    const target = await this.userRepository.findOneBy({ id: userId });
    if (!target) throw new NotFoundException(`No se encontró el usuario ${userId}.`);
    if (target.institutionId !== administrator.institutionId)
      throw new ForbiddenException('No puedes revisar usuarios de otra institución.');
    if (target.role === UserRoles.Administrador)
      throw new BadRequestException('Los administradores solo se crean mediante migración.');

    target.approvalStatus = status;
    target.authVersion = (target.authVersion ?? 1) + 1;
    return this.userRepository.save(target);
  }

  async findOneById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: [
        'courses',
        'submissions',
        'submissions.evaluation',
        'submissions.assignment',
        'submissions.assignment.rubric',
      ],
    });
    if (!user) throw new NotFoundException(`No se encontró el usuario ${id}.`);
    return user;
  }

  async findOneByEmail(email: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { email },
      relations: ['courses'],
    });
    if (!user) throw new NotFoundException(`No se encontró un usuario con el correo ${email}.`);
    return user;
  }

  async updateOwnProfile(input: UpdateOwnProfileInput, actor: User): Promise<User> {
    await this.findOneById(actor.id);
    const user = await this.userRepository.preload({
      id: actor.id,
      ...input,
    });
    if (!user) throw new NotFoundException(`No se encontró el usuario ${actor.id}.`);

    try {
      return await this.userRepository.save(user);
    } catch (error) {
      this.handleDBException(error);
    }
  }

  /**
   * Compatibility path for the existing frontend. It is deliberately self-only;
   * institutional administration must use its dedicated status/approval operations.
   */
  async update(id: string, updateUserInput: UpdateUserInput, actor: User): Promise<User> {
    if (id !== actor.id)
      throw new ForbiddenException('Solo puedes actualizar los datos de tu propia cuenta.');

    const currentUser = await this.findOneById(actor.id);
    if (updateUserInput.role !== undefined && updateUserInput.role !== currentUser.role)
      throw new ForbiddenException('No puedes cambiar el rol de tu propia cuenta.');

    const { id: _, role: __, isActive, password, ...personalData } = updateUserInput;
    const user = await this.userRepository.preload({
      id: actor.id,
      ...personalData,
      ...(isActive === false ? { isActive: false } : {}),
    });
    if (!user) throw new NotFoundException(`No se encontró el usuario ${actor.id}.`);

    const mustInvalidateSessions =
      Boolean(password) || (isActive === false && currentUser.isActive !== false);
    if (mustInvalidateSessions) user.authVersion = (currentUser.authVersion ?? 1) + 1;
    if (password) {
      // Encrypt password
      user.password = bcrypt.hashSync(password, 10);
      await this.mailService.sendUpdatePassword(user, password);
    }

    let savedUser: User;
    try {
      savedUser = await this.userRepository.save(user);
    } catch (error) {
      this.handleDBException(error);
    }
    if (mustInvalidateSessions)
      this.logger.log(
        `La versión de autenticación del usuario ${actor.id} cambió a ${savedUser.authVersion}.`
      );
    return savedUser;
  }

  async block(id: string, administrator: User): Promise<User> {
    if (administrator.role !== UserRoles.Administrador)
      throw new ForbiddenException('Solo un administrador puede desactivar usuarios.');
    if (id === administrator.id)
      throw new ForbiddenException('No puedes desactivar tu cuenta desde la administración.');

    const userToBlock = await this.findOneById(id);
    if (!administrator.isPlatformAdmin && userToBlock.institutionId !== administrator.institutionId)
      throw new ForbiddenException('No puedes administrar usuarios de otra institución.');
    if (userToBlock.isPlatformAdmin || userToBlock.role === UserRoles.Administrador)
      throw new ForbiddenException('No puedes desactivar otra cuenta administrativa.');

    userToBlock.isActive = false;
    userToBlock.authVersion = (userToBlock.authVersion ?? 1) + 1;
    const savedUser = await this.userRepository.save(userToBlock);
    this.logger.log(
      `El usuario ${id} fue desactivado; la versión de autenticación es ${savedUser.authVersion}.`
    );
    return savedUser;
  }

  async resetPassword(email: string): Promise<User> {
    return this.authService.forgotPassword(email);
  }

  async resetPasswordAuth(password: string, user: User): Promise<User> {
    const userFound = await this.findOneById(user.id);
    await this.mailService.sendUpdatePassword(userFound, password);
    userFound.password = bcrypt.hashSync(password, 10);
    userFound.authVersion = (userFound.authVersion ?? 1) + 1;
    const savedUser = await this.userRepository.save(userFound);
    this.logger.log(`El cambio de contraseña invalidó las sesiones del usuario ${savedUser.id}.`);
    return savedUser;
  }

  async assignCourses({ userId, courseIds }: AssignCoursesInput, actor: User): Promise<User> {
    const isAdministrator = actor.role === UserRoles.Administrador;
    const isTeacher = actor.role === UserRoles.Docente;
    if (!isAdministrator && !isTeacher)
      throw new ForbiddenException('No tienes permisos para asignar cursos.');

    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['courses', 'courses.user'],
    });

    if (!user)
      throw new BadRequestException(`No se encontró el usuario con identificador ${userId}.`);
    if (!actor.isPlatformAdmin && user.institutionId !== actor.institutionId)
      throw new ForbiddenException('No puedes administrar usuarios de otra institución.');
    if (user.isPlatformAdmin || user.role !== UserRoles.Estudiante)
      throw new ForbiddenException('Los cursos solo pueden asignarse a estudiantes.');
    if (isTeacher && (!user.isActive || user.approvalStatus !== InstitutionApprovalStatus.APPROVED))
      throw new ForbiddenException('Solo puedes asignar cursos a estudiantes activos y aprobados.');

    const courses = await this.courseRepository.find({
      where: {
        id: In(courseIds),
        user: isTeacher
          ? { id: actor.id, institutionId: actor.institutionId }
          : { institutionId: user.institutionId },
      },
      relations: ['user'],
    });

    if (courses.length !== courseIds.length)
      throw new BadRequestException(
        isTeacher
          ? 'Algunos cursos no existen o no pertenecen al docente actual.'
          : 'Algunos cursos no existen o pertenecen a otra institución.'
      );

    if (isTeacher) {
      const coursesFromOtherTeachers = (user.courses ?? []).filter(
        (course) => course.user?.id !== actor.id
      );
      user.courses = [...coursesFromOtherTeachers, ...courses];
    } else {
      user.courses = courses;
    }

    return await this.userRepository.save(user);
  }

  private handleDBException(error: any): never {
    if (error.code === '23505') throw new BadRequestException(error.detail);

    throw new InternalServerErrorException(
      'Ocurrió un error inesperado. Revisa los registros del servidor.'
    );
  }
}
