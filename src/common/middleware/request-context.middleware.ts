import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { secureCompare } from '../security';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;
const TRACEPARENT_PATTERN = /^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/i;

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly configService: ConfigService) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const trustedBff = secureCompare(
      request.headers['x-bff-secret'],
      this.configService.get<string>('BFF_SHARED_SECRET')
    );
    const incomingRequestId = request.headers['x-request-id'];
    const requestId =
      trustedBff &&
      typeof incomingRequestId === 'string' &&
      REQUEST_ID_PATTERN.test(incomingRequestId)
        ? incomingRequestId
        : randomUUID();
    const traceparent = request.headers.traceparent;

    (request as Request & { requestId: string; traceparent?: string }).requestId = requestId;
    if (trustedBff && typeof traceparent === 'string' && TRACEPARENT_PATTERN.test(traceparent)) {
      (request as Request & { traceparent?: string }).traceparent = traceparent;
      response.setHeader('traceparent', traceparent);
    }
    response.setHeader('X-Request-ID', requestId);
    next();
  }
}
