import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { GraphQLError } from 'graphql';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('GlobalExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | object = 'Error interno del servidor.';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.getResponse();
    } else if (this.isTypeORMError(exception)) {
      const { code, detail } = exception as any;
      if (code === '23505') {
        status = HttpStatus.CONFLICT;
        message = detail ? detail.replace('Key ', '') : 'Violación de clave duplicada.';
      } else if (code === '23503') {
        status = HttpStatus.BAD_REQUEST;
        message = 'Violación de clave foránea. Verifica los recursos relacionados.';
      } else if (code === 'error-001') {
        status = HttpStatus.BAD_REQUEST;
        message = detail ? detail.replace('Key ', '') : 'Error personalizado de base de datos.';
      }
    }

    const errorSource = this.getErrorSource((exception as Error).stack);

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(`Error en ${errorSource}: ${message}`, (exception as Error).stack);
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
      if (exception instanceof GraphQLError) throw exception;
      const errorMessage =
        status >= HttpStatus.INTERNAL_SERVER_ERROR
          ? 'Error interno del servidor.'
          : this.normalizeMessage(message);
      throw new GraphQLError(errorMessage, {
        extensions: {
          code: this.graphqlCode(status),
          statusCode: status,
        },
      });
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

  private graphqlCode(status: number): string {
    if (status === HttpStatus.BAD_REQUEST || status === HttpStatus.UNPROCESSABLE_ENTITY)
      return 'BAD_USER_INPUT';
    if (status === HttpStatus.UNAUTHORIZED) return 'UNAUTHENTICATED';
    if (status === HttpStatus.FORBIDDEN) return 'FORBIDDEN';
    if (status === HttpStatus.NOT_FOUND) return 'NOT_FOUND';
    if (status === HttpStatus.CONFLICT) return 'CONFLICT';
    if (status === HttpStatus.TOO_MANY_REQUESTS) return 'TOO_MANY_REQUESTS';
    if (status === HttpStatus.SERVICE_UNAVAILABLE) return 'SERVICE_UNAVAILABLE';
    return 'INTERNAL_SERVER_ERROR';
  }

  private normalizeMessage(message: string | object): string {
    if (typeof message === 'string') return message;
    const candidate = (message as { message?: unknown }).message;
    if (Array.isArray(candidate)) return candidate.map(String).join('; ');
    if (typeof candidate === 'string') return candidate;
    return 'La solicitud no pudo procesarse.';
  }

  private getErrorSource(stack: string | undefined): string {
    if (!stack) return 'Origen desconocido';

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

    return 'Origen desconocido';
  }
}
