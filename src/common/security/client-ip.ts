import { isIP } from 'net';

type RequestLike = {
  headers?: Record<string, unknown>;
  ip?: string;
  isTrustedBff?: boolean;
  socket?: { remoteAddress?: string };
};

export const trustedClientIp = (request: RequestLike): string => {
  const forwarded = request.headers?.['x-client-ip'];
  if (request.isTrustedBff && typeof forwarded === 'string' && isIP(forwarded)) return forwarded;
  return request.ip || request.socket?.remoteAddress || 'unknown';
};
