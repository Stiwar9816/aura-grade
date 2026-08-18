import { GradingQueueEvents } from 'src/submission/grading-queue.events';
import { SubmissionStatus } from 'src/enums';

describe('GradingQueueEvents', () => {
  const submissionRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
  };
  const notificationsGateway = { notifyStudent: jest.fn() };
  const gradingQueue = { getJob: jest.fn() };
  const notificationQueue = { enqueueGradingFailed: jest.fn() };
  const events = new GradingQueueEvents(
    submissionRepository as never,
    notificationsGateway as never,
    gradingQueue as never,
    notificationQueue as never
  );

  beforeEach(() => {
    jest.clearAllMocks();
    submissionRepository.findOne.mockResolvedValue({
      id: 'submission-id',
      student: { id: 'student-id' },
    });
    notificationQueue.enqueueGradingFailed.mockResolvedValue('grading-failed-job-id');
  });

  it('marks and notifies a submission only after the final failed attempt', async () => {
    gradingQueue.getJob.mockResolvedValue({
      data: { id: 'submission-id' },
      attemptsMade: 3,
      opts: { attempts: 3 },
    });

    await events.onFailed({ jobId: 'job-id', failedReason: 'AI unavailable' });

    expect(submissionRepository.update).toHaveBeenCalledWith('submission-id', {
      status: SubmissionStatus.FAILED,
      gradingFailureReason: 'El servicio de IA no pudo completar la evaluación.',
    });
    expect(notificationsGateway.notifyStudent).toHaveBeenCalledWith('student-id', {
      submissionId: 'submission-id',
      status: SubmissionStatus.FAILED,
      message: 'La evaluación falló tras varios intentos.',
    });
    expect(notificationQueue.enqueueGradingFailed).toHaveBeenCalledWith('submission-id', 'job-id');
  });

  it('does not mark the submission as failed while retries remain', async () => {
    gradingQueue.getJob.mockResolvedValue({
      data: { id: 'submission-id' },
      attemptsMade: 1,
      opts: { attempts: 3 },
    });

    await events.onFailed({ jobId: 'job-id', failedReason: 'Temporary failure' });

    expect(submissionRepository.update).not.toHaveBeenCalled();
    expect(notificationsGateway.notifyStudent).not.toHaveBeenCalled();
    expect(notificationQueue.enqueueGradingFailed).not.toHaveBeenCalled();
  });

  it('stores a safe category instead of the raw provider failure', async () => {
    gradingQueue.getJob.mockResolvedValue({
      data: { id: 'submission-id' },
      attemptsMade: 3,
      opts: { attempts: 3 },
    });

    await events.onFailed({
      jobId: 'job-id',
      failedReason: '401 Unauthorized: invalid API_KEY secret-value',
    });

    expect(submissionRepository.update).toHaveBeenCalledWith('submission-id', {
      status: SubmissionStatus.FAILED,
      gradingFailureReason:
        'El servicio de IA no está disponible por un problema de configuración.',
    });
    expect(submissionRepository.update).not.toHaveBeenCalledWith(
      'submission-id',
      expect.objectContaining({ gradingFailureReason: expect.stringContaining('secret-value') })
    );
  });

  it('keeps the definitive failure recorded when the notification queue is unavailable', async () => {
    gradingQueue.getJob.mockResolvedValue({
      data: { id: 'submission-id' },
      attemptsMade: 3,
      opts: { attempts: 3 },
    });
    notificationQueue.enqueueGradingFailed.mockRejectedValue(new Error('Redis unavailable'));

    await expect(
      events.onFailed({ jobId: 'job-id', failedReason: 'AI unavailable' })
    ).resolves.toBeUndefined();

    expect(submissionRepository.update).toHaveBeenCalledWith(
      'submission-id',
      expect.objectContaining({ status: SubmissionStatus.FAILED })
    );
    expect(notificationsGateway.notifyStudent).toHaveBeenCalled();
  });
});
