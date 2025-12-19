import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
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
