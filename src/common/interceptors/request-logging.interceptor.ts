import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { isIP } from 'net';
import { Observable, tap } from 'rxjs';
import { AuditService } from '../../audit/audit.service';

const MUTATING_HTTP_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const SENSITIVE_KEY_PATTERN =
  /password|token|secret|authorization|cookie|credential|document_num|documentNumber/i;

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Request');

  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const isHttp = context.getType() === 'http';
    const gqlContext = isHttp ? undefined : GqlExecutionContext.create(context).getContext();
    const request = isHttp ? context.switchToHttp().getRequest() : gqlContext?.req;
    const response = isHttp ? context.switchToHttp().getResponse() : gqlContext?.res;
    const startedAt = Date.now();
    let errorStatus: number | undefined;

    return next.handle().pipe(
      tap({
        next: (result: unknown) => {
          const auditEntry = this.createAuditEntry(context, request, result);
          if (auditEntry) {
            void this.auditService.record(auditEntry).catch((error: unknown) => {
              this.logger.error(
                `No fue posible persistir auditoría ${request?.requestId ?? ''}: ${
                  error instanceof Error ? error.message : 'error desconocido'
                }`
              );
            });
          }
        },
        error: (error: unknown) => {
          errorStatus = error instanceof HttpException ? error.getStatus() : 500;
        },
        finalize: () => {
          const entry = JSON.stringify({
            requestId: request?.requestId,
            method: request?.method,
            path: request?.originalUrl,
            statusCode: errorStatus ?? response?.statusCode,
            durationMs: Date.now() - startedAt,
          });
          if (errorStatus && errorStatus >= 500) this.logger.error(entry);
          else if (errorStatus) this.logger.warn(entry);
          else this.logger.log(entry);
        },
      })
    );
  }

  private createAuditEntry(context: ExecutionContext, request: any, result: unknown) {
    const user = request?.user;
    if (!user?.id || !user?.institutionId) return null;

    const isHttp = context.getType() === 'http';
    let action: string;
    let resource: string;
    let changes: Record<string, unknown> | undefined;

    if (isHttp) {
      const method = String(request?.method ?? '').toUpperCase();
      if (!MUTATING_HTTP_METHODS.has(method)) return null;
      action = method === 'POST' ? 'CREATE' : method === 'DELETE' ? 'DELETE' : 'UPDATE';
      resource = context.getClass().name.replace(/Controller$/, '') || 'HTTP';
      changes = this.sanitize(request?.body) as Record<string, unknown> | undefined;
    } else {
      const gql = GqlExecutionContext.create(context);
      const info = gql.getInfo();
      if (info?.operation?.operation !== 'mutation') return null;
      action = this.constantCase(info.fieldName || context.getHandler().name);
      resource = context.getClass().name.replace(/Resolver$/, '') || 'GraphQL';
      changes = this.sanitize(request?.body?.variables) as Record<string, unknown> | undefined;
    }

    const resourceId = this.resourceId(request, result);
    return {
      actorUserId: user.id,
      actorName: `${user.name ?? ''} ${user.last_name ?? ''}`.trim() || 'Usuario',
      actorEmail: user.email,
      institutionId: user.institutionId,
      ipAddress: this.clientIp(request),
      action,
      resource,
      resourceId,
      changes,
      requestId: request?.requestId,
      path: request?.originalUrl,
    };
  }

  private clientIp(request: any): string | undefined {
    const trustedClientIp = request?.isTrustedBff ? request?.headers?.['x-client-ip'] : undefined;
    const candidate =
      (typeof trustedClientIp === 'string' ? trustedClientIp : undefined) ||
      request?.ip ||
      request?.socket?.remoteAddress;
    return typeof candidate === 'string' && isIP(candidate) ? candidate : undefined;
  }

  private resourceId(request: any, result: unknown): string | undefined {
    if (result && typeof result === 'object' && 'id' in result) {
      const id = (result as { id?: unknown }).id;
      if (typeof id === 'string' || typeof id === 'number') return String(id);
    }
    const candidates = [
      request?.params?.id,
      request?.body?.variables?.id,
      request?.body?.variables?.input?.id,
      request?.body?.variables?.input?.userId,
    ];
    const id = candidates.find(
      (candidate) => typeof candidate === 'string' || typeof candidate === 'number'
    );
    return id === undefined ? undefined : String(id);
  }

  private sanitize(value: unknown, depth = 0): unknown {
    if (value === null || value === undefined) return value;
    if (depth >= 5) return '[TRUNCATED]';
    if (typeof value === 'string') return value.slice(0, 500);
    if (typeof value !== 'object') return value;
    if (Array.isArray(value)) {
      return value.slice(0, 50).map((item) => this.sanitize(item, depth + 1));
    }

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 100)
        .map(([key, item]) => [
          key,
          SENSITIVE_KEY_PATTERN.test(key) ? '[REDACTED]' : this.sanitize(item, depth + 1),
        ])
    );
  }

  private constantCase(value: string): string {
    return value
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toUpperCase();
  }
}
