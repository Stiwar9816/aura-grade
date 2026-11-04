import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { normalizeConfiguredSecret, secureCompare } from '../security';
import { SKIP_BFF_AUTH } from './skip-bff-auth.decorator';

@Injectable()
export class BffAuthGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly reflector: Reflector = new Reflector()
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.isSelfAuthenticated(context)) return true;
    const request = this.getRequest(context);
    const path = request.originalUrl ?? request.url ?? '';
    if (path.startsWith('/api/health') || path.startsWith('/api/metrics')) return true;

    const expected = normalizeConfiguredSecret(this.configService.get<string>('BFF_SHARED_SECRET'));
    const isDevelopment = this.configService.get<string>('STATE') === 'dev';
    if (!expected && isDevelopment) return true;

    if (!secureCompare(request.headers?.['x-bff-secret'], expected))
      throw new ForbiddenException('El acceso directo al backend no está permitido.');
    request.isTrustedBff = true;
    return true;
  }

  /** Opt-in per handler: the endpoint must verify its own caller (never a global bypass). */
  private isSelfAuthenticated(context: ExecutionContext): boolean {
    const targets = [context.getHandler?.(), context.getClass?.()].filter(Boolean);
    return (
      targets.length > 0 &&
      this.reflector.getAllAndOverride<boolean>(SKIP_BFF_AUTH, targets) === true
    );
  }

  private getRequest(context: ExecutionContext) {
    if (context.getType() === 'http') return context.switchToHttp().getRequest();
    return GqlExecutionContext.create(context).getContext().req;
  }
}
