import { AuditQueueEvents } from 'src/audit/audit-queue.events';
import * as SentryReporter from 'src/observability/sentry-reporter';

describe('AuditQueueEvents', () => {
  const queue = { getJob: jest.fn() };
  const metrics = { increment: jest.fn() };
  const events = new AuditQueueEvents(queue as any, metrics as any);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(SentryReporter, 'captureExhaustedQueueJob').mockImplementation();
  });

  it('counts only failures that exhausted all retries', async () => {
    queue.getJob.mockResolvedValue({ attemptsMade: 5, opts: { attempts: 5 } });

    await events.onFailed({ jobId: 'event-1', failedReason: 'database unavailable' });

    expect(metrics.increment).toHaveBeenCalledWith('audit_failed_total');
    expect(SentryReporter.captureExhaustedQueueJob).toHaveBeenCalledWith('audit', 'event-1', 5);
  });

  it('does not count a failure while BullMQ can still retry it', async () => {
    queue.getJob.mockResolvedValue({ attemptsMade: 2, opts: { attempts: 5 } });

    await events.onFailed({ jobId: 'event-1', failedReason: 'database unavailable' });

    expect(metrics.increment).not.toHaveBeenCalled();
    expect(SentryReporter.captureExhaustedQueueJob).not.toHaveBeenCalled();
  });
});
