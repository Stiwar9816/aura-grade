import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { RequestLoggingInterceptor } from 'src/common/interceptors/request-logging.interceptor';

class InstitutionController {}

describe('RequestLoggingInterceptor audit', () => {
  const auditService = { record: jest.fn().mockResolvedValue(undefined) };
  const interceptor = new RequestLoggingInterceptor(auditService as any);

  beforeEach(() => jest.clearAllMocks());

  it('records authenticated mutations and redacts sensitive fields', async () => {
    const request = {
      requestId: 'request-1234',
      method: 'POST',
      originalUrl: '/api/institutions',
      isTrustedBff: true,
      headers: { 'x-client-ip': '203.0.113.10' },
      body: {
        name: 'Universidad Aura',
        password: 'NeverPersistThis',
        nested: { sessionToken: 'NeverPersistThisEither' },
      },
      user: {
        id: '1553d33b-798b-4ce5-b943-1fa8bf8ea01c',
        name: 'Aura',
        last_name: 'Admin',
        email: 'admin@aura.edu.co',
        institutionId: '73a8fa1d-626e-4081-bad4-6e131d288bd5',
      },
    };
    const context = {
      getType: jest.fn().mockReturnValue('http'),
      getClass: jest.fn().mockReturnValue(InstitutionController),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: () => request,
        getResponse: () => ({ statusCode: 201 }),
      }),
    } as unknown as ExecutionContext;
    const next = { handle: () => of({ id: 'institution-1' }) } as CallHandler;

    await lastValueFrom(interceptor.intercept(context, next));

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATE',
        resource: 'Institution',
        resourceId: 'institution-1',
        ipAddress: '203.0.113.10',
        changes: {
          name: 'Universidad Aura',
          password: '[REDACTED]',
          nested: { sessionToken: '[REDACTED]' },
        },
      })
    );
  });

  it('does not create audit records for reads', async () => {
    const context = {
      getType: jest.fn().mockReturnValue('http'),
      getClass: jest.fn().mockReturnValue(InstitutionController),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: () => ({ method: 'GET' }),
        getResponse: () => ({ statusCode: 200 }),
      }),
    } as unknown as ExecutionContext;

    await lastValueFrom(interceptor.intercept(context, { handle: () => of([]) } as CallHandler));

    expect(auditService.record).not.toHaveBeenCalled();
  });
});
