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

export const trustedClientUserAgent = (request: RequestLike): string | undefined => {
  const forwarded = request.headers?.['x-client-user-agent'];
  const direct = request.headers?.['user-agent'];
  const candidate = request.isTrustedBff && typeof forwarded === 'string' ? forwarded : direct;
  return typeof candidate === 'string' ? candidate.slice(0, 512) : undefined;
};
