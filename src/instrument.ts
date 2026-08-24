import * as Sentry from '@sentry/nestjs';
import { envs } from './config';

const enabled = envs.sentry_enabled && Boolean(envs.sentry_dsn) && envs.state !== 'test';
const configuredSampleRate = Number(envs.sentry_traces_sample_rate ?? 0);
const sensitiveKey = /authorization|cookie|password|token|secret|credential|api.?key|otp|document/i;
const sensitiveValuePatterns = [
  /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /\b(password|token|secret|credential|api[_-]?key|otp)\s*[:=]\s*[^\s,;]+/gi,
  /:\/\/[^\s/@:]+:[^\s/@]+@/g,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
];

const redactString = (value: string): string =>
  sensitiveValuePatterns.reduce(
    (sanitized, pattern) => sanitized.replace(pattern, '[Filtered]'),
    value
  );

const sanitize = (value: unknown, seen = new WeakSet<object>()): unknown => {
  if (typeof value === 'string') return redactString(value);
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) return value.map((item) => sanitize(item, seen));

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      sensitiveKey.test(key) ? '[Filtered]' : sanitize(item, seen),
    ])
  );
};

Sentry.init({
  dsn: envs.sentry_dsn,
  enabled,
  environment: envs.sentry_environment ?? envs.state,
  release: envs.sentry_release || undefined,
  sendDefaultPii: false,
  enableLogs: true,
  tracesSampleRate: Number.isFinite(configuredSampleRate) ? configuredSampleRate : 0,
  integrations: [Sentry.consoleLoggingIntegration({ levels: ['log', 'warn', 'error'] })],
  beforeSendLog(log) {
    return {
      ...log,
      message: redactString(String(log.message)) as typeof log.message,
      attributes: sanitize(log.attributes) as typeof log.attributes,
    };
  },
  beforeSend(event) {
    if (event.request) {
      delete event.request.data;
      delete event.request.cookies;
      delete event.request.query_string;
      if (event.request.url) event.request.url = event.request.url.split(/[?#]/, 1)[0];

      if (event.request.headers) {
        event.request.headers = Object.fromEntries(
          Object.entries(event.request.headers).filter(([key]) => !sensitiveKey.test(key))
        );
      }
    }

    if (event.user) {
      delete event.user.email;
      delete event.user.ip_address;
    }

    if (event.extra) event.extra = sanitize(event.extra) as typeof event.extra;
    if (event.contexts) event.contexts = sanitize(event.contexts) as typeof event.contexts;
    if (event.message) event.message = redactString(event.message);
    if (event.logentry?.message) event.logentry.message = redactString(event.logentry.message);
    if (event.exception?.values) {
      event.exception.values = event.exception.values.map((value) => ({
        ...value,
        value: value.value ? redactString(value.value) : value.value,
      }));
    }
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => ({
        ...breadcrumb,
        message: breadcrumb.message ? redactString(breadcrumb.message) : breadcrumb.message,
        data: sanitize(breadcrumb.data) as typeof breadcrumb.data,
      }));
    }

    return event;
  },
});
