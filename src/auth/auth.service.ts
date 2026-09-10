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
// DTO
import { CreateUserDto, LoginUserDto, VerifyOtpDto } from './dto';
import { UserRoles } from './enums';
// Interfaces
import { JwtPayload } from './interface/jwt-payload.interface';
// Services
import { MailService } from 'src/mail/mail.service';
import { SessionDevice, SessionService } from './session';
import { Logger } from '@nestjs/common';
import { AuthMetricsService } from '../observability';
import { AuthAttemptService, PasswordService } from './security';
import { InstitutionApprovalStatus, InstitutionService } from 'src/institution';
import { PasswordResetService } from './security/password-reset.service';
import { TwoFactorService } from './two-factor';

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
    private readonly institutionService: InstitutionService,
    private readonly passwordService: PasswordService,
    private readonly twoFactorService: TwoFactorService,
    private readonly passwordResetService: PasswordResetService
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
      password: await this.passwordService.hash(password),
    });

    // Convertir IDs (string[]) → [{ id }, { id }, ...]
    if (courses?.length)
      throw new BadRequestException('La matrícula debe gestionarla el docente o administrador.');

    try {
      await this.authRepository.save(user);
    } catch (error) {
      this.handleDBException(error);
    }

    try {
      await this.mailService.sendUserConfirmation(user);
    } catch {
      this.logger.error('Registro completado; no se pudo enviar el aviso de bienvenida.');
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
        isPlatformAdmin: true,
        twoFactorSecretEncrypted: true,
        twoFactorEnabledAt: true,
        twoFactorLastCounter: true,
      },
      relations: ['courses', 'assignments', 'institution'],
    });

    const passwordMatches = await this.passwordService.verify(
      password,
      user?.password ?? AuthService.DUMMY_PASSWORD_HASH
    );
    if (!user || user.email !== email || !passwordMatches) {
      this.metrics.increment('auth_login_failure_total');
      this.logger.warn('Falló la autenticación.');
      await this.authAttempts.registerFailure(clientIdentity);
      throw new UnauthorizedException('Credenciales inválidas.');
    }
    if (!user.isActive) {
      this.metrics.increment('auth_login_failure_total');
      this.logger.warn('Autenticación rechazada: el usuario está inactivo.');
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
    await this.authAttempts.clear(clientIdentity);
    if (this.passwordService.needsRehash(user.password)) {
      await this.authRepository.update(user.id, {
        password: await this.passwordService.hash(password),
      });
      this.logger.log(`El hash de contraseña del usuario ${user.id} fue actualizado a scrypt.`);
    }

    const challenge = await this.twoFactorService.createChallenge(user, rememberMe);
    this.metrics.increment('auth_otp_challenge_total');
    this.logger.log(`Segundo factor requerido para el usuario ${user.id}.`);
    return challenge;
  }

  async verifyOtp({ challengeToken, otp }: VerifyOtpDto, device?: SessionDevice) {
    const { rememberMe, user, recoveryCodes, recoveryUsed } =
      await this.twoFactorService.verifyChallenge(challengeToken, otp);
    if (recoveryUsed) return this.twoFactorService.createChallenge(user, rememberMe);
    const session = await this.sessionService.create(user, rememberMe, 'mfa', device);
    this.metrics.increment('auth_login_success_total');
    this.logger.log(`Segundo factor validado y sesión creada para el usuario ${user.id}.`);
    return {
      ...this.authResponse(user, session),
      rememberMe,
      ...(recoveryCodes ? { recoveryCodes } : {}),
    };
  }

  async generateRecoveryCodes(user: User, otp: string) {
    return { recoveryCodes: await this.twoFactorService.generateRecoveryCodes(user, otp) };
  }

  async forgotPassword(email: string): Promise<void> {
    return this.passwordResetService.request(email);
  }

  async resetPassword(token: string, newPassword: string): Promise<{ success: true }> {
    await this.passwordResetService.complete(token, newPassword);
    return { success: true };
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
      throw new UnauthorizedException('El usuario está inactivo. Comunícate con un administrador.');

    this.sanitizeUser(user);
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
    this.sanitizeUser(currentUser);
    return { user: currentUser };
  }

  async logout(sessionToken?: string): Promise<{ success: true }> {
    if (sessionToken) await this.sessionService.revoke(sessionToken);
    return { success: true };
  }

  async logoutAll(user: User): Promise<{ success: true; revokedSessions: number }> {
    return this.logoutAllForUser(user.id);
  }

  async listSessions(user: User, currentSessionToken?: string) {
    return { sessions: await this.sessionService.list(user, currentSessionToken) };
  }

  async revokeSession(user: User, sessionId: string, currentSessionToken?: string) {
    const currentSession = this.sessionService.isCurrent(currentSessionToken, sessionId);
    const revoked = await this.sessionService.revokeOwned(user.id, sessionId);
    return { currentSession, revoked, success: true as const };
  }

  async logoutAllForUser(
    userId: string,
    actor?: User
  ): Promise<{ success: true; revokedSessions: number }> {
    const target = await this.authRepository.findOneBy({ id: userId });
    if (!target) throw new NotFoundException('Usuario no encontrado.');
    if (
      actor &&
      actor.id !== target.id &&
      !actor.isPlatformAdmin &&
      actor.institutionId !== target.institutionId
    )
      throw new ForbiddenException('No puedes revocar sesiones de otra institución.');
    if (
      actor &&
      actor.id !== target.id &&
      !actor.isPlatformAdmin &&
      target.role === UserRoles.Administrador
    )
      throw new ForbiddenException(
        'Solo un administrador de plataforma puede revocar otro administrador.'
      );
    await this.authRepository.increment({ id: userId }, 'authVersion', 1);
    const revokedSessions = await this.sessionService.revokeAll(userId);
    this.logger.log(`Se revocaron todas las sesiones del usuario ${userId}.`);
    return { success: true, revokedSessions };
  }

  private authResponse(user: User, session: { sessionToken: string; expiresAt: string }) {
    return {
      user,
      sessionToken: session.sessionToken,
      expiresAt: session.expiresAt,
    };
  }

  private sanitizeUser(user: User): void {
    delete user.password;
    delete user.twoFactorSecretEncrypted;
    delete user.twoFactorLastCounter;
  }

  private handleDBException(error: any): never {
    if (error.code === '23505') throw new BadRequestException(error.detail);

    throw new InternalServerErrorException(
      'Ocurrió un error inesperado. Revisa los registros del servidor.'
    );
  }
}
