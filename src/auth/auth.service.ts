// NestJS
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
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
import { UserRoles } from './enums';
// Interfaces
import { JwtPayload } from './interface/jwt-payload.interface';
// Services
import { MailService } from 'src/mail/mail.service';
import { SessionService } from './session';
import { Logger } from '@nestjs/common';
import { AuthMetricsService } from '../observability';
import { AuthAttemptService } from './security';
import { InstitutionApprovalStatus, InstitutionService } from 'src/institution';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private static readonly DUMMY_PASSWORD_HASH =
    '$2b$12$KaYTPi.r79aQ5ET0li.9SeLMWjBkBYMuW.nX5PuAtlEeXkkTlPg/.';

  constructor(
    @InjectRepository(User)
    private readonly authRepository: Repository<User>,
    private readonly mailService: MailService,
    private readonly jwtService: JwtService,
    private readonly sessionService: SessionService,
    private readonly authAttempts: AuthAttemptService,
    private readonly metrics: AuthMetricsService,
    private readonly institutionService: InstitutionService
  ) {}

  getToken(payload: JwtPayload) {
    return this.jwtService.sign(payload);
  }

  async register(createAuthDto: CreateUserDto) {
    const {
      password,
      courses,
      institutionId,
      role = UserRoles.Estudiante,
      ...userInfo
    } = createAuthDto;
    const institution = await this.institutionService.findActiveById(institutionId);
    const user = this.authRepository.create({
      ...userInfo,
      role,
      institutionId: institution.id,
      institution,
      approvalStatus: InstitutionApprovalStatus.PENDING,
      password: bcrypt.hashSync(password, 12),
    });

    // Convertir IDs (string[]) → [{ id }, { id }, ...]
    if (courses?.length) user.courses = courses.map((id) => ({ id })) as any;

    try {
      await this.authRepository.save(user);
    } catch (error) {
      this.handleDBException(error);
    }

    delete user.password;
    return {
      user,
      pendingApproval: true,
      message: 'Tu registro fue recibido y está pendiente de aprobación institucional.',
    };
  }

  async login(loginUserDto: LoginUserDto, clientIdentity = 'unknown') {
    const { password, rememberMe = false } = loginUserDto;
    const email = loginUserDto.email.toLowerCase().trim();
    const user = await this.authRepository.findOne({
      where: { email },
      select: {
        id: true,
        name: true,
        last_name: true,
        document_num: true,
        password: true,
        phone: true,
        email: true,
        role: true,
        approvalStatus: true,
        institutionId: true,
        document_type: true,
        isActive: true,
        authVersion: true,
      },
      relations: ['courses', 'assignments', 'institution'],
    });

    const passwordMatches = bcrypt.compareSync(
      password,
      user?.password ?? AuthService.DUMMY_PASSWORD_HASH
    );
    if (!user || user.email !== email || !passwordMatches) {
      this.metrics.increment('auth_login_failure_total');
      this.logger.warn('Authentication failed');
      await this.authAttempts.registerFailure(clientIdentity);
      throw new UnauthorizedException('Credenciales inválidas.');
    }
    if (!user.isActive) {
      this.metrics.increment('auth_login_failure_total');
      this.logger.warn('Authentication rejected for an inactive user');
      await this.authAttempts.registerFailure(clientIdentity);
      throw new UnauthorizedException('Credenciales inválidas.');
    }
    if (user.approvalStatus !== InstitutionApprovalStatus.APPROVED || !user.institution?.isActive) {
      await this.authAttempts.clear(clientIdentity);
      throw new ForbiddenException(
        user.approvalStatus === InstitutionApprovalStatus.REJECTED
          ? 'Tu solicitud institucional fue rechazada.'
          : 'Tu cuenta está pendiente de aprobación institucional.'
      );
    }
    delete user.password;

    await this.authAttempts.clear(clientIdentity);
    const session = await this.sessionService.create(user, rememberMe);
    this.metrics.increment('auth_login_success_total');
    this.logger.log(`Authentication succeeded for user ${user.id}`);
    return this.authResponse(user, session);
  }

  async validateUser(id: string): Promise<User> {
    const user = await this.authRepository.findOne({
      where: { id },
      relations: ['institution'],
    });
    if (
      !user ||
      !user.isActive ||
      user.approvalStatus !== InstitutionApprovalStatus.APPROVED ||
      !user.institution?.isActive
    )
      throw new UnauthorizedException(`The user is inactive, please speak to an administrator.`);

    delete user.password;
    return user;
  }

  async me(user: User): Promise<{ user: User }> {
    const currentUser = await this.authRepository.findOne({
      where: { id: user.id },
      relations: ['courses', 'assignments', 'institution'],
    });
    if (
      !currentUser ||
      !currentUser.isActive ||
      currentUser.approvalStatus !== InstitutionApprovalStatus.APPROVED ||
      !currentUser.institution?.isActive
    )
      throw new UnauthorizedException('Sesión inválida o expirada.');
    delete currentUser.password;
    return { user: currentUser };
  }

  async logout(sessionToken?: string): Promise<{ success: true }> {
    if (sessionToken) await this.sessionService.revoke(sessionToken);
    return { success: true };
  }

  async logoutAll(user: User): Promise<{ success: true; revokedSessions: number }> {
    return this.logoutAllForUser(user.id);
  }

  async logoutAllForUser(userId: string): Promise<{ success: true; revokedSessions: number }> {
    const target = await this.authRepository.findOneBy({ id: userId });
    if (!target) throw new NotFoundException('Usuario no encontrado.');
    await this.authRepository.increment({ id: userId }, 'authVersion', 1);
    const revokedSessions = await this.sessionService.revokeAll(userId);
    this.logger.log(`All sessions revoked for user ${userId}`);
    return { success: true, revokedSessions };
  }

  private authResponse(user: User, session: { sessionToken: string; expiresAt: string }) {
    return {
      user,
      sessionToken: session.sessionToken,
      token: session.sessionToken,
      expiresAt: session.expiresAt,
    };
  }

  private handleDBException(error: any): never {
    if (error.code === '23505') throw new BadRequestException(error.detail);

    throw new InternalServerErrorException('Unexpected error, check server logs');
  }
}
