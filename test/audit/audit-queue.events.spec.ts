import { AuditQueueEvents } from 'src/audit/audit-queue.events';

describe('AuditQueueEvents', () => {
  const queue = { getJob: jest.fn() };
  const metrics = { increment: jest.fn() };
  const events = new AuditQueueEvents(queue as any, metrics as any);

  beforeEach(() => jest.clearAllMocks());

  it('counts only failures that exhausted all retries', async () => {
    queue.getJob.mockResolvedValue({ attemptsMade: 5, opts: { attempts: 5 } });

    await events.onFailed({ jobId: 'event-1', failedReason: 'database unavailable' });

    expect(metrics.increment).toHaveBeenCalledWith('audit_failed_total');
  });

  it('does not count a failure while BullMQ can still retry it', async () => {
    queue.getJob.mockResolvedValue({ attemptsMade: 2, opts: { attempts: 5 } });

    await events.onFailed({ jobId: 'event-1', failedReason: 'database unavailable' });

    expect(metrics.increment).not.toHaveBeenCalled();
  });
});
