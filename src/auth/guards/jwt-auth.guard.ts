// NestJS
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
// GraphQL
import { GqlExecutionContext } from '@nestjs/graphql';
import { SessionService } from '../session';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly sessionService: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = this.getRequest(context);
    const token = this.bearerToken(request.headers?.authorization);
    if (!token) throw new UnauthorizedException('Sesión inválida o expirada.');

    if (this.looksLikeJwt(token))
      throw new UnauthorizedException('La sesión debe renovarse con verificación OTP.');

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
}
