import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GqlExecutionContext } from '@nestjs/graphql';
import { secureCompare } from '../security';

@Injectable()
export class BffAuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = this.getRequest(context);
    const path = request.originalUrl ?? request.url ?? '';
    if (path.startsWith('/api/health') || path.startsWith('/api/metrics')) return true;

    const expected = this.configService.get<string>('BFF_SHARED_SECRET');
    const isDevelopment = this.configService.get<string>('STATE') === 'dev';
    if (!expected && isDevelopment) return true;

    if (!secureCompare(request.headers?.['x-bff-secret'], expected))
      throw new ForbiddenException('El acceso directo al backend no está permitido.');
    request.isTrustedBff = true;
    return true;
  }

  private getRequest(context: ExecutionContext) {
    if (context.getType() === 'http') return context.switchToHttp().getRequest();
    return GqlExecutionContext.create(context).getContext().req;
  }
}
