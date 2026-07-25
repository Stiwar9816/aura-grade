import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerGuard } from '@nestjs/throttler';
import { createHash } from 'crypto';

@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(
    req: Record<string, any>,
    context?: ExecutionContext
  ): Promise<string> {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const email =
      typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : undefined;
    if (context?.getHandler().name === 'login' && email) return `${ip}:${email}`;
    const recoveryEmail = req.body?.variables?.resetPassword;
    if (context?.getHandler().name === 'resetPassword' && typeof recoveryEmail === 'string')
      return `${ip}:${recoveryEmail.toLowerCase().trim()}`;

    const authorization = req.headers?.authorization;
    if (typeof authorization === 'string') {
      const [scheme, token] = authorization.trim().split(/\s+/, 2);
      if (scheme?.toLowerCase() === 'bearer' && token) {
        const tokenHash = createHash('sha256').update(token).digest('hex');
        return `${ip}:${tokenHash}`;
      }
    }
    return ip;
  }

  getRequestResponse(context: ExecutionContext) {
    const gqlCtx = GqlExecutionContext.create(context);
    const ctx = gqlCtx.getContext();

    // GraphQL context support
    if (ctx) {
      const req = ctx.req || ctx.request;
      const res = ctx.res || ctx.reply;
      if (req) {
        return {
          req,
          res: res || { header: () => {}, getHeader: () => {} },
        };
      }
    }

    // HTTP context support
    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();

    // Comprehensive Fallback (for Seeds or internal calls)
    return {
      req: req || { ip: '127.0.0.1', headers: {} },
      res:
        res && typeof res.header === 'function' ? res : { header: () => {}, getHeader: () => {} },
    };
  }
}
