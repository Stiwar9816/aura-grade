import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('GlobalExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | object = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.getResponse();
    } else if (this.isTypeORMError(exception)) {
      const { code, detail } = exception as any;
      if (code === '23505') {
        status = HttpStatus.BAD_REQUEST;
        message = detail ? detail.replace('Key ', '') : 'Duplicate key violation';
      } else if (code === '23503') {
        status = HttpStatus.BAD_REQUEST;
        message = 'Foreign key violation: Check related resources';
      } else if (code === 'error-001') {
        status = HttpStatus.BAD_REQUEST;
        message = detail ? detail.replace('Key ', '') : 'Custom DB error';
      }
    }

    const errorSource = this.getErrorSource((exception as Error).stack);

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(`Error in ${errorSource}: ${message}`, (exception as Error).stack);
    }

    if (host.getType() === 'http') {
      const ctx = host.switchToHttp();
      const response = ctx.getResponse<Response>();
      const request = ctx.getRequest<Request>();

      response.status(status).json({
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        services: errorSource,
        message: typeof message === 'string' ? message : (message as any).message || message,
      });
    } else if ((host.getType() as string) === 'graphql') {
      const responseBody = {
        statusCode: status,
        timestamp: new Date().toISOString(),
        services: errorSource,
        message: typeof message === 'string' ? message : (message as any).message || message,
      };
      // Throwing HttpException allows NestJS GraphQL driver to catch it.
      // The responseBody will likely be serialized into the output message or extension.
      throw new HttpException(responseBody, status);
    }
  }

  private isTypeORMError(exception: unknown): boolean {
    const error = exception as any;
    return (
      error &&
      typeof error === 'object' &&
      (error.code === '23505' || error.code === '23503' || error.code === 'error-001')
    );
  }

  private getErrorSource(stack: string | undefined): string {
    if (!stack) return 'Unknown Source';

    const lines = stack.split('\n');
    // Find the first line that is part of our src code but not node_modules or standard internals
    // and not this filter itself.
    const sourceLine = lines.find(
      (line) =>
        !line.includes('node_modules') &&
        !line.includes('node:') &&
        !line.includes('http-exception.filter') &&
        (line.includes('src') || line.includes('dist') || line.includes('aura-grade'))
    );

    if (sourceLine) {
      // Intentar extraer "at Class.method ("
      const match = sourceLine.match(/at\s+(?:async\s+)?(.+?)\s+\(/);
      if (match && match[1]) {
        return match[1];
      }
      // If no function name, return the file path section
      const fileMatch = sourceLine.match(/\((.+?)\)/);
      if (fileMatch && fileMatch[1]) {
        return fileMatch[1];
      }
      return sourceLine.trim();
    }

    return 'Unknown Source';
  }
}
