import { NotificationQueueService } from 'src/notifications/notification-queue.service';
import { NotificationJobType } from 'src/notifications/notification-queue.constants';

describe('NotificationQueueService', () => {
  const queue = { getJob: jest.fn(), add: jest.fn(), upsertJobScheduler: jest.fn() };
  const metrics = { increment: jest.fn() };
  const service = new NotificationQueueService(queue as any, metrics as any);

  beforeEach(() => {
    jest.clearAllMocks();
    queue.getJob.mockResolvedValue(null);
    queue.add.mockResolvedValue({ id: 'job-id' });
    queue.upsertJobScheduler.mockResolvedValue({ id: 'scheduler-job' });
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

  it('registers the durable deadline reminder scheduler', async () => {
    await service.onModuleInit();

    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      'assignment-deadline-reminder-scan',
      { every: 30 * 60 * 1000 },
      expect.objectContaining({ name: NotificationJobType.DEADLINE_REMINDER_SCAN })
    );
    expect(queue.add).toHaveBeenCalledWith(
      NotificationJobType.DEADLINE_REMINDER_SCAN,
      expect.objectContaining({ aggregateId: 'startup-scan' }),
      expect.objectContaining({ jobId: expect.stringContaining('assignment-deadline-reminder-') })
    );
  });

  it('uses a stable per-recipient key for assignment reminders', async () => {
    const dueDate = new Date('2026-08-17T12:00:00.000Z');

    const result = await service.enqueueAssignmentReminder(
      'assignment-id',
      'student-id',
      dueDate,
      'AUTO_24H' as any,
      new Date('2026-08-16T12:00:00.000Z')
    );

    expect(result.queued).toBe(true);
    expect(queue.add).toHaveBeenCalledWith(
      NotificationJobType.ASSIGNMENT_REMINDER,
      expect.objectContaining({
        aggregateId: 'assignment-id',
        recipientId: 'student-id',
        dueDateEpoch: dueDate.getTime(),
      }),
      expect.objectContaining({ jobId: expect.stringContaining('assignment-reminder-') })
    );
  });

  it('keeps the real six-hour cooldown across fixed bucket boundaries', async () => {
    const now = new Date('2026-08-15T12:01:00.000Z');
    queue.getJob.mockImplementation((eventKey: string) =>
      Promise.resolve(
        eventKey.includes('manual-1786773600000')
          ? { timestamp: new Date('2026-08-15T11:59:00.000Z').getTime() }
          : null
      )
    );

    await expect(
      service.getManualAssignmentReminderCooldownUntil(
        'assignment-id',
        'student-id',
        new Date('2026-08-17T12:00:00.000Z'),
        now
      )
    ).resolves.toEqual(new Date('2026-08-15T17:59:00.000Z'));
  });
});
