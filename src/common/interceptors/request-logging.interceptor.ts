import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable, tap } from 'rxjs';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Request');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const isHttp = context.getType() === 'http';
    const gqlContext = isHttp ? undefined : GqlExecutionContext.create(context).getContext();
    const request = isHttp ? context.switchToHttp().getRequest() : gqlContext?.req;
    const response = isHttp ? context.switchToHttp().getResponse() : gqlContext?.res;
    const startedAt = Date.now();
    let errorStatus: number | undefined;

    return next.handle().pipe(
      tap({
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
}
