import { ForbiddenException } from '@nestjs/common';
import { BffAuthGuard } from 'src/common/guards/bff-auth.guard';
import { SkipBffAuth } from 'src/common/guards/skip-bff-auth.decorator';

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

  it('accepts a raw env-file value wrapped in quotes', () => {
    const guard = new BffAuthGuard({
      get: (key: string) => (key === 'BFF_SHARED_SECRET' ? `"${'a'.repeat(32)}"` : 'prod'),
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

  it('keeps health checks public', () => {
    const guard = new BffAuthGuard({ get: jest.fn() } as any);
    expect(guard.canActivate(context({ originalUrl: '/api/health', headers: {} }))).toBe(true);
  });

  describe('SkipBffAuth', () => {
    class Controller {
      @SkipBffAuth()
      selfAuthenticated() {}
      protected() {}
    }
    const guard = () =>
      new BffAuthGuard({
        get: (key: string) => (key === 'BFF_SHARED_SECRET' ? 'a'.repeat(32) : 'prod'),
      } as any);
    const handlerContext = (handler: () => void) =>
      ({
        getType: () => 'http',
        getHandler: () => handler,
        getClass: () => Controller,
        switchToHttp: () => ({
          getRequest: () => ({ originalUrl: '/api/telegram/webhook', headers: {} }),
        }),
      }) as any;

    it('skips only handlers that opt in', () => {
      expect(guard().canActivate(handlerContext(Controller.prototype.selfAuthenticated))).toBe(
        true
      );
    });

    it('still protects sibling handlers on the same path', () => {
      expect(() => guard().canActivate(handlerContext(Controller.prototype.protected))).toThrow(
        ForbiddenException
      );
    });
  });
});
