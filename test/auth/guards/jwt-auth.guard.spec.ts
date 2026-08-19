import { UnauthorizedException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(() => {
    guard = new JwtAuthGuard({} as any);
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

      const executionContext = { getType: jest.fn().mockReturnValue('graphql') } as any;
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

      const executionContext = { getType: jest.fn().mockReturnValue('graphql') } as any;
      const result = guard.getRequest(executionContext);

      expect(result.headers.authorization).toBe('Bearer test-token-123');
    });
  });

  it('never accepts a legacy JWT because it has no OTP assurance', async () => {
    const request = { headers: { authorization: 'Bearer header.payload.signature' } };
    const context = {
      getType: jest.fn().mockReturnValue('http'),
      switchToHttp: jest.fn().mockReturnValue({ getRequest: () => request }),
    } as any;
    guard = new JwtAuthGuard({} as any);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
