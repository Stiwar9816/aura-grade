import * as Sentry from '@sentry/nestjs';

type SentryTagValue = string | number | boolean;
type SentryPrimitive = SentryTagValue | null | undefined;

type OperationalContext = {
  extras?: Record<string, SentryPrimitive>;
  userId?: string;
};

export const captureOperationalException = (
  exception: unknown,
  tags: Record<string, SentryTagValue> = {},
  context: OperationalContext = {}
): void => {
  Sentry.withScope((scope) => {
    for (const [key, value] of Object.entries(tags)) scope.setTag(key, value);
    if (context.extras) scope.setExtras(context.extras);
    if (context.userId) scope.setUser({ id: context.userId });
    Sentry.captureException(exception);
  });
};

export const captureExhaustedQueueJob = (
  queue: string,
  jobId: string,
  attemptsMade: number,
  additionalTags: Record<string, SentryTagValue> = {}
): void => {
  captureOperationalException(new Error(`El trabajo de la cola ${queue} agotó sus reintentos.`), {
    component: 'bullmq',
    queue,
    job_id: jobId,
    attempts: attemptsMade,
    ...additionalTags,
  });
};
