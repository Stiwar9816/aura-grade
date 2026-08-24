import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  HttpStatus,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GraphQLError } from 'graphql';
import { HttpExceptionFilter } from 'src/common/filters/http-exception.filter';
import * as SentryReporter from 'src/observability/sentry-reporter';

describe('HttpExceptionFilter GraphQL contract', () => {
  const host = { getType: () => 'graphql' } as unknown as ArgumentsHost;
  const filter = new HttpExceptionFilter();

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(SentryReporter, 'captureOperationalException').mockImplementation();
  });

  const capture = (error: unknown): GraphQLError => {
    try {
      filter.catch(error, host);
      throw new Error('The filter did not throw');
    } catch (caught) {
      return caught as GraphQLError;
    }
  };

  it.each([
    [new BadRequestException(['campo requerido', 'valor inválido']), 'BAD_USER_INPUT', 400],
    [new NotFoundException('No existe'), 'NOT_FOUND', 404],
    [new ConflictException('Ya existe'), 'CONFLICT', 409],
  ])('maps client errors to stable GraphQL codes', (exception, code, statusCode) => {
    const error = capture(exception);

    expect(error).toBeInstanceOf(GraphQLError);
    expect(error.extensions).toEqual({ code, statusCode });
  });

  it('maps a unique database violation to CONFLICT', () => {
    const error = capture({ code: '23505', detail: 'Key (email) already exists' });

    expect(error.extensions).toEqual({ code: 'CONFLICT', statusCode: HttpStatus.CONFLICT });
  });

  it('does not disclose internal error details', () => {
    const error = capture(new Error('password or infrastructure detail'));

    expect(error.message).toBe('Error interno del servidor.');
    expect(error.extensions).toEqual({
      code: 'INTERNAL_SERVER_ERROR',
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    });
    expect(SentryReporter.captureOperationalException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        component: 'global_exception_filter',
        transport: 'graphql',
        status_code: 500,
      }),
      expect.any(Object)
    );
  });

  it('reports service-unavailable responses as relevant 5xx errors', () => {
    const error = capture(new ServiceUnavailableException('Redis no disponible'));

    expect(error.extensions).toEqual({
      code: 'SERVICE_UNAVAILABLE',
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
    });
    expect(SentryReporter.captureOperationalException).toHaveBeenCalledWith(
      expect.any(ServiceUnavailableException),
      expect.objectContaining({ status_code: 503 }),
      expect.any(Object)
    );
  });

  it('preserves an existing GraphQLError and its extensions', () => {
    const original = new GraphQLError('custom', {
      extensions: { code: 'CUSTOM', statusCode: 418 },
    });

    expect(capture(original)).toBe(original);
    expect(SentryReporter.captureOperationalException).not.toHaveBeenCalled();
  });
});
