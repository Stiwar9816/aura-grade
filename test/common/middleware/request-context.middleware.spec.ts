import { RequestContextMiddleware } from 'src/common/middleware/request-context.middleware';

describe('RequestContextMiddleware', () => {
  const secret = 's'.repeat(32);
  const middleware = new RequestContextMiddleware({
    get: () => secret,
  } as any);

  it('accepts tracing headers only from the trusted BFF', () => {
    const request: any = {
      headers: {
        'x-bff-secret': secret,
        'x-request-id': 'request-12345678',
        traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      },
    };
    const response = { setHeader: jest.fn() } as any;
    const next = jest.fn();

    middleware.use(request, response, next);

    expect(request.requestId).toBe('request-12345678');
    expect(request.traceparent).toBe(request.headers.traceparent);
    expect(next).toHaveBeenCalled();
  });

  it('replaces an untrusted request id', () => {
    const request: any = {
      headers: { 'x-request-id': 'attacker-controlled' },
    };
    const response = { setHeader: jest.fn() } as any;

    middleware.use(request, response, jest.fn());

    expect(request.requestId).not.toBe('attacker-controlled');
  });
});
