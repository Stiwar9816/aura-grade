// NestJS
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
// GraphQL
import { GqlExecutionContext } from '@nestjs/graphql';
import { User } from '../../user/entities/user.entity';
import { JwtPayload } from '../interface/jwt-payload.interface';
import { SessionService } from '../session';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly sessionService: SessionService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(User) private readonly userRepository: Repository<User>
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = this.getRequest(context);
    const token = this.bearerToken(request.headers?.authorization);
    if (!token) throw new UnauthorizedException('Sesión inválida o expirada.');

    if (this.looksLikeJwt(token)) {
      const acceptLegacyJwt = this.configService.get<boolean | string>(
        'AUTH_ACCEPT_LEGACY_JWT',
        true
      );
      if (acceptLegacyJwt === false || acceptLegacyJwt === 'false')
        throw new UnauthorizedException('Sesión inválida o expirada.');
      request.user = await this.validateLegacyJwt(token);
      request.sessionToken = undefined;
      return true;
    }

    const result = await this.sessionService.validate(token);
    if (!result) throw new UnauthorizedException('Sesión inválida o expirada.');
    request.user = result.user;
    request.session = result.session;
    request.sessionToken = token;
    return true;
  }

  getRequest(context: ExecutionContext) {
    if (context.getType() === 'http') return context.switchToHttp().getRequest();
    const ctx = GqlExecutionContext.create(context);
    const { req } = ctx.getContext();
    return req;
  }

  private bearerToken(authorization?: string): string | null {
    if (!authorization) return null;
    const [scheme, token, extra] = authorization.trim().split(/\s+/);
    return scheme?.toLowerCase() === 'bearer' && token && !extra ? token : null;
  }

  private looksLikeJwt(token: string): boolean {
    return token.split('.').length === 3;
  }

  private async validateLegacyJwt(token: string): Promise<User> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Sesión inválida o expirada.');
    }

    const user = await this.userRepository.findOneBy({ id: payload.id });
    if (!user || !user.isActive) throw new UnauthorizedException('Sesión inválida o expirada.');
    delete user.password;
    return user;
  }
}
