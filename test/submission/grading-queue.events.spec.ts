import { GradingQueueEvents } from 'src/submission/grading-queue.events';
import { SubmissionStatus } from 'src/enums';

describe('GradingQueueEvents', () => {
  const submissionRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
  };
  const notificationsGateway = { notifyStudent: jest.fn() };
  const gradingQueue = { getJob: jest.fn() };
  const events = new GradingQueueEvents(
    submissionRepository as never,
    notificationsGateway as never,
    gradingQueue as never
  );

  beforeEach(() => {
    jest.clearAllMocks();
    submissionRepository.findOne.mockResolvedValue({
      id: 'submission-id',
      student: { id: 'student-id' },
    });
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
    });
    expect(notificationsGateway.notifyStudent).toHaveBeenCalledWith('student-id', {
      submissionId: 'submission-id',
      status: SubmissionStatus.FAILED,
      message: 'La evaluación falló tras varios intentos.',
    });
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
  });
});
