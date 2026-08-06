import { NotificationQueueService } from 'src/notifications/notification-queue.service';
import { NotificationJobType } from 'src/notifications/notification-queue.constants';

describe('NotificationQueueService', () => {
  const queue = { getJob: jest.fn(), add: jest.fn() };
  const metrics = { increment: jest.fn() };
  const service = new NotificationQueueService(queue as any, metrics as any);

  beforeEach(() => {
    jest.clearAllMocks();
    queue.getJob.mockResolvedValue(null);
    queue.add.mockResolvedValue({ id: 'job-id' });
  });

  it('enqueues a retryable new-submission job with a stable identifier', async () => {
    await expect(service.enqueueNewSubmission('submission-id')).resolves.toBe(
      'new-submission-submission-id'
    );

    expect(queue.add).toHaveBeenCalledWith(
      NotificationJobType.NEW_SUBMISSION,
      {
        type: NotificationJobType.NEW_SUBMISSION,
        aggregateId: 'submission-id',
        eventKey: 'new-submission-submission-id',
      },
      expect.objectContaining({
        jobId: 'new-submission-submission-id',
        attempts: 5,
        backoff: { type: 'exponential', delay: 10_000 },
      })
    );
    expect(metrics.increment).toHaveBeenCalledWith('notification_queued_total');
  });

  it('does not enqueue a duplicate job still retained by BullMQ', async () => {
    queue.getJob.mockResolvedValue({ id: 'grade-published-evaluation-id' });

    await expect(service.enqueuePublishedGrade('evaluation-id')).resolves.toBe(
      'grade-published-evaluation-id'
    );

    expect(queue.add).not.toHaveBeenCalled();
    expect(metrics.increment).toHaveBeenCalledWith('notification_duplicate_total');
  });

  it('records queue infrastructure failures and propagates them', async () => {
    queue.add.mockRejectedValue(new Error('Redis unavailable'));

    await expect(service.enqueuePublishedGrade('evaluation-id')).rejects.toThrow(
      'Redis unavailable'
    );
    expect(metrics.increment).toHaveBeenCalledWith('notification_enqueue_failed_total');
  });
});
