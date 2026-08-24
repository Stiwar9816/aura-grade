import { NotificationQueueEvents } from 'src/notifications/notification-queue.events';
import * as SentryReporter from 'src/observability/sentry-reporter';

describe('NotificationQueueEvents', () => {
  const queue = { getJob: jest.fn() };
  const metrics = { increment: jest.fn() };
  const listener = new NotificationQueueEvents(queue as any, metrics as any);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(SentryReporter, 'captureExhaustedQueueJob').mockImplementation();
  });

  it('records a retry while attempts remain', async () => {
    queue.getJob.mockResolvedValue({ attemptsMade: 2, opts: { attempts: 5 } });

    await listener.onFailed({ jobId: 'job-id', failedReason: 'Temporary failure' });

    expect(metrics.increment).toHaveBeenCalledWith('notification_retry_total');
    expect(metrics.increment).not.toHaveBeenCalledWith('notification_exhausted_total');
  });

  it('records a final failure after attempts are exhausted', async () => {
    queue.getJob.mockResolvedValue({ attemptsMade: 5, opts: { attempts: 5 } });

    await listener.onFailed({ jobId: 'job-id', failedReason: 'Permanent failure' });

    expect(metrics.increment).toHaveBeenCalledWith('notification_exhausted_total');
    expect(SentryReporter.captureExhaustedQueueJob).toHaveBeenCalledWith(
      'notifications',
      'job-id',
      5,
      { notification_type: 'UNKNOWN' }
    );
  });

  it('records completed jobs', () => {
    listener.onCompleted();
    expect(metrics.increment).toHaveBeenCalledWith('notification_job_completed_total');
  });
});
