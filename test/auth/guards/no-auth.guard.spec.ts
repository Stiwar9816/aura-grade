import { ExecutionContext } from '@nestjs/common';
import { NoAuthAuthGuard } from 'src/auth/guards/no-auth.guard';

describe('NoAuthAuthGuard', () => {
  let guard: NoAuthAuthGuard;

  beforeEach(() => {
    guard = new NoAuthAuthGuard();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should always return true', () => {
      const mockExecutionContext = {} as ExecutionContext;
      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });

    it('should allow access without authentication', () => {
      const mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({}),
        }),
      } as any;

      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });
  });
});
