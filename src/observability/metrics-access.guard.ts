import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { secureCompare } from '../common/security';

@Injectable()
export class MetricsAccessGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const expected = this.configService.get<string>('METRICS_TOKEN');
    const isDevelopment = this.configService.get<string>('STATE') === 'dev';
    if (!expected && isDevelopment) return true;

    const authorization = request.headers.authorization;
    const [scheme, token] =
      typeof authorization === 'string' ? authorization.trim().split(/\s+/, 2) : [];
    if (scheme?.toLowerCase() !== 'bearer' || !secureCompare(token, expected))
      throw new ForbiddenException('Métricas no autorizadas.');
    return true;
  }
}
