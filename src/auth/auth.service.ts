// NestJS
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
// Jwt
import { JwtService } from '@nestjs/jwt';
// TypeORM
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
// Entities
import { User } from '../user/entities/user.entity';
// Bcrypt
import * as bcrypt from 'bcryptjs';
// DTO
import { CreateUserDto, LoginUserDto } from './dto';
// Interfaces
import { JwtPayload } from './interface/jwt-payload.interface';
// Services
import { MailService } from 'src/mail/mail.service';
import { UserRoles } from './enums';
import { Course } from 'src/course/entities/course.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly authRepository: Repository<User>,
    private readonly mailService: MailService,
    private readonly jwtService: JwtService
  ) {}

  getToken(payload: JwtPayload) {
    return this.jwtService.sign(payload);
  }

  async register(createAuthDto: CreateUserDto) {
    try {
      const { password, courses, ...userInfo } = createAuthDto;
      const user = this.authRepository.create({
        ...userInfo,
        password: bcrypt.hashSync(password, 12),
      });

      // Convertir IDs (string[]) → [{ id }, { id }, ...]
      if (courses?.length) user.courses = courses.map((id) => ({ id })) as any;

      await this.authRepository.save(user);

      // Guarda una copia sin encriptar de la contraseña
      const plainPassword = password;
      // Envía la contraseña sin encriptar por correo electrónico
      await this.mailService.sendUserConfirmation(user, plainPassword);

      delete user.password;

      const token = this.getToken({
        id: user.id,
        email: user.email,
        name: user.name,
        last_name: user.last_name,
        role: user.role,
      });

      return {
        ...user,
        token,
      };
    } catch (error) {
      this.handleDBErrros(error);
    }
  }

  async login(loginUserDto: LoginUserDto) {
    const { password, email } = loginUserDto;
    //TODO: Chague authRepository for UserService
    const user = await this.authRepository.findOne({
      where: { email },
      select: { email: true, password: true, id: true, name: true, role: true },
    });

    if (!user) throw new UnauthorizedException('Credentials are not valid');
    if (user.email !== email) throw new UnauthorizedException('Credentials are not valid (Email)');

    await this.validateUser(user.role);

    if (!bcrypt.compareSync(password, user.password)) {
      throw new BadRequestException('Password not match');
    }
    delete user.password;

    const token = this.getToken({
      id: user.id,
      email: user.email,
      name: user.name,
      last_name: user.last_name,
      role: user.role,
    });

    return {
      ...user,
      token,
    };
  }

  async validateUser(role: UserRoles): Promise<User> {
    //TODO: Chague authRepository for UserService
    const user = await this.authRepository.findOneByOrFail({ role });
    if (!user.isActive)
      throw new UnauthorizedException(`The user is inactive, please speak to an administrator.`);

    delete user.password;
    return user;
  }
  private handleDBErrros(errors: any): never {
    if (errors.code === '23505') {
      throw new BadRequestException(errors.detail);
    }
    console.log(errors);
    throw new InternalServerErrorException('Please check server logs');
  }
}
