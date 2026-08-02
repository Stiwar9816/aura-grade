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

  async update(id: string, updateUserInput: UpdateUserInput): Promise<User> {
    const currentUser = await this.findOneById(id);
    const user = await this.userRepository.preload({
      id,
      ...updateUserInput,
    });
    if (!user) throw new NotFoundException(`No se encontró el usuario ${id}.`);
    const mustInvalidateSessions =
      Boolean(updateUserInput.password) ||
      (updateUserInput.role !== undefined && updateUserInput.role !== currentUser.role) ||
      (updateUserInput.isActive !== undefined && updateUserInput.isActive !== currentUser.isActive);
    if (mustInvalidateSessions) user.authVersion = (currentUser.authVersion ?? 1) + 1;
    if (updateUserInput.password) {
      // Encrypt password
      user.password = bcrypt.hashSync(updateUserInput.password, 10);
      await this.mailService.sendUpdatePassword(user, updateUserInput.password);
    }
    const savedUser = await this.userRepository.save(user);
    if (mustInvalidateSessions)
      this.logger.log(
        `La versión de autenticación del usuario ${id} cambió a ${savedUser.authVersion}.`
      );
    return savedUser;
  }

  async block(id: string): Promise<User> {
    const userToBlock = await this.findOneById(id);
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

  async assignCourses({ userId, courseIds }: AssignCoursesInput): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['courses'],
    });

    if (!user)
      throw new BadRequestException(`No se encontró el usuario con identificador ${userId}.`);

    const courses = await this.courseRepository.findBy({
      id: In(courseIds),
    });

    if (courses.length !== courseIds.length)
      throw new BadRequestException('Algunos cursos no existen.');

    // Asignación
    user.courses = courses;

    return await this.userRepository.save(user);
  }

  private handleDBException(error: any): never {
    if (error.code === '23505') throw new BadRequestException(error.detail);

    throw new InternalServerErrorException(
      'Ocurrió un error inesperado. Revisa los registros del servidor.'
    );
  }
}
