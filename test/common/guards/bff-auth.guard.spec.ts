import { ForbiddenException } from '@nestjs/common';
import { BffAuthGuard } from 'src/common/guards/bff-auth.guard';

describe('BffAuthGuard', () => {
  const context = (request: any) =>
    ({
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: () => request }),
    }) as any;

  it('allows the configured BFF secret', () => {
    const guard = new BffAuthGuard({
      get: (key: string) => (key === 'BFF_SHARED_SECRET' ? 'a'.repeat(32) : 'prod'),
    } as any);

    expect(
      guard.canActivate(
        context({
          originalUrl: '/api/auth/me',
          headers: { 'x-bff-secret': 'a'.repeat(32) },
        })
      )
    ).toBe(true);
  });

  it('rejects direct production access', () => {
    const guard = new BffAuthGuard({
      get: (key: string) => (key === 'BFF_SHARED_SECRET' ? 'a'.repeat(32) : 'prod'),
    } as any);

    expect(() => guard.canActivate(context({ originalUrl: '/api/graphql', headers: {} }))).toThrow(
      ForbiddenException
    );
  });

  it('keeps health checks public', () => {
    const guard = new BffAuthGuard({ get: jest.fn() } as any);
    expect(guard.canActivate(context({ originalUrl: '/api/health', headers: {} }))).toBe(true);
  });
});
