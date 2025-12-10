import { ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(() => {
    guard = new JwtAuthGuard();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('getRequest', () => {
    it('should extract request from GraphQL context', () => {
      const mockRequest = {
        headers: {
          authorization: 'Bearer token',
        },
        user: { id: '123' },
      };

      const mockContext = {
        getContext: jest.fn().mockReturnValue({ req: mockRequest }),
      };

      jest.spyOn(GqlExecutionContext, 'create').mockReturnValue(mockContext as any);

      const executionContext = {} as ExecutionContext;
      const result = guard.getRequest(executionContext);

      expect(GqlExecutionContext.create).toHaveBeenCalledWith(executionContext);
      expect(mockContext.getContext).toHaveBeenCalled();
      expect(result).toBe(mockRequest);
    });

    it('should return request object with authorization header', () => {
      const mockRequest = {
        headers: {
          authorization: 'Bearer test-token-123',
        },
      };

      const mockContext = {
        getContext: jest.fn().mockReturnValue({ req: mockRequest }),
      };

      jest.spyOn(GqlExecutionContext, 'create').mockReturnValue(mockContext as any);

      const executionContext = {} as ExecutionContext;
      const result = guard.getRequest(executionContext);

      expect(result.headers.authorization).toBe('Bearer test-token-123');
    });
  });
});
