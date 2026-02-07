// NestJS
import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
// TypeORM
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
// Bcrypt
import * as bcrypt from 'bcryptjs';
// Dto
import { AssignCoursesInput, CreateUserInput, UpdateUserInput } from './dto';
// Entities
import { User } from './entities/user.entity';
import { Course } from 'src/course/entities/course.entity';
// Services
import { MailService } from 'src/mail/mail.service';
import { AuthService } from 'src/auth/auth.service';
// Utils
import { randomPassword } from 'src/auth/common';

@Injectable()
export class UserService {
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
    // Guarda una copia sin encriptar de la contraseña
    const plainPassword = createUserInput.password;
    // Envía la contraseña sin encriptar por correo electrónico
    await this.mailService.sendUpdatePassword(user, plainPassword);
    // Encrypt password
    user.password = bcrypt.hashSync(user.password, 10);
    return this.userRepository.save(user);
  }

  async findAll(user: User): Promise<User[]> {
    const allowedRoles = ['Estudiante', 'Docente', 'Administrador'];
    return this.userRepository.find({
      where: {
        role: In(allowedRoles),
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
    if (!user) throw new NotFoundException(`${id} not found`);
    return user;
  }

  async findOneByEmail(email: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { email },
      relations: ['courses'],
    });
    if (!user) throw new NotFoundException(`${email} not found`);
    return user;
  }

  async update(id: string, updateUserInput: UpdateUserInput): Promise<User> {
    const user = await this.userRepository.preload({
      id,
      ...updateUserInput,
    });
    if (updateUserInput.password) {
      // Guarda una copia sin encriptar de la contraseña
      const plainPassword = updateUserInput.password;
      // Envía la contraseña sin encriptar por correo electrónico
      await this.mailService.sendUpdatePassword(user, plainPassword);
      // Encrypt password
      user.password = bcrypt.hashSync(updateUserInput.password, 10);
    }
    return await this.userRepository.save(user);
  }

  async block(id: string): Promise<User> {
    const userToBlock = await this.findOneById(id);
    userToBlock.isActive = false;
    return await this.userRepository.save(userToBlock);
  }

  async resetPassword(email: string): Promise<User> {
    const userReset = await this.findOneByEmail(email);
    const newPassword = randomPassword();
    this.mailService.sendResetPassword(userReset, newPassword);
    userReset.password = bcrypt.hashSync(newPassword, 10);
    return await this.userRepository.save(userReset);
  }

  async resetPasswordAuth(password: string, user: User): Promise<User> {
    const token = this.authService.getToken(user);
    const decodedToken = this.jwtService.verify(token); // Decodifica el token
    const id = decodedToken.id; // Obtiene el ID del usuario del token decodificado

    const userFound = await this.findOneById(id);
    const newPassword = password;
    this.mailService.sendResetPassword(userFound, newPassword);
    userFound.password = bcrypt.hashSync(newPassword, 10);
    return await this.userRepository.save(userFound);
  }

  async assignCourses({ userId, courseIds }: AssignCoursesInput): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['courses'],
    });

    if (!user) throw new BadRequestException(`User with ID ${userId} not found`);

    const courses = await this.courseRepository.findBy({
      id: In(courseIds),
    });

    if (courses.length !== courseIds.length)
      throw new BadRequestException(`Some courses do not exist`);

    // Asignación
    user.courses = courses;

    return await this.userRepository.save(user);
  }
}
