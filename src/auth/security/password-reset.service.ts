import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { User } from 'src/user/entities/user.entity';
import { MailService } from 'src/mail/mail.service';
import { PasswordService } from './password.service';

export const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly passwords: PasswordService,
    private readonly mail: MailService
  ) {}

  async request(email: string): Promise<void> {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.hash(token);
    // Atomic cooldown; requesting a link never changes credentials or sessions.
    const result = await this.users
      .createQueryBuilder()
      .update(User)
      .set({
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
        passwordResetRequestedAt: new Date(),
        passwordResetAuthVersion: () => '"authVersion"',
      })
      .where('email = :email AND "isActive" = true', { email: email.toLowerCase().trim() })
      .andWhere('(password_reset_requested_at IS NULL OR password_reset_requested_at < :cutoff)', {
        cutoff: new Date(Date.now() - 5 * 60 * 1000),
      })
      .returning('id')
      .execute();
    if (!result.affected) return;
    const user = await this.users.findOneBy({ id: result.raw[0].id });
    if (!user) return;
    try {
      await this.mail.sendResetPassword(user, token);
    } catch {
      await this.users.update(
        { id: user.id, passwordResetTokenHash: tokenHash },
        {
          passwordResetTokenHash: null,
          passwordResetExpiresAt: null,
        }
      );
      this.logger.error('No se pudo entregar un enlace de recuperación de contraseña.');
    }
  }

  async complete(token: string, newPassword: string): Promise<void> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw this.invalidToken();
    const hash = this.hash(token);
    const user = await this.users.findOne({
      where: { passwordResetTokenHash: hash, passwordResetExpiresAt: MoreThan(new Date()) },
      select: { id: true, authVersion: true, passwordResetAuthVersion: true },
    });
    if (!user || user.authVersion !== user.passwordResetAuthVersion) throw this.invalidToken();
    const password = await this.passwords.hash(newPassword);
    // CAS prevents concurrent redemptions and invalidates existing sessions atomically.
    const result = await this.users
      .createQueryBuilder()
      .update(User)
      .set({
        password,
        authVersion: () => '"authVersion" + 1',
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        passwordResetAuthVersion: null,
      })
      .where('id = :id AND password_reset_token_hash = :hash', { id: user.id, hash })
      .andWhere(
        'password_reset_expires_at > :now AND "authVersion" = :version AND "isActive" = true',
        {
          now: new Date(),
          version: user.authVersion,
        }
      )
      .execute();
    if (!result.affected) throw this.invalidToken();
    const updated = await this.users.findOneBy({ id: user.id });
    if (updated) {
      try {
        await this.mail.sendUpdatePassword(updated);
      } catch {
        this.logger.error('No se pudo enviar el aviso de cambio de contraseña.');
      }
    }
  }

  private hash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
  private invalidToken() {
    return new BadRequestException(
      'El enlace es inválido, ya fue utilizado o expiró. Solicita uno nuevo.'
    );
  }
}
