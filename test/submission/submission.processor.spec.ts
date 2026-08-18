import { SubmissionProcessor } from 'src/submission/submission.processor';
import { EvaluationOrigin, SubmissionStatus } from 'src/enums';

describe('SubmissionProcessor', () => {
  const submissionRepository = {
    findOne: jest.fn(),
    increment: jest.fn(),
    update: jest.fn(),
  };
  const extractorService = { extractTextFromUrl: jest.fn() };
  const aiService = { evaluateSubmission: jest.fn() };
  const evaluationService = { createDraft: jest.fn() };
  const notificationsGateway = { notifyStudent: jest.fn() };
  const config = { get: jest.fn().mockReturnValue('gemini') };
  const processor = new SubmissionProcessor(
    submissionRepository as never,
    extractorService as never,
    aiService as never,
    evaluationService as never,
    notificationsGateway as never,
    config as never
  );
  const job = {
    id: 'job-id',
    data: { id: 'submission-id', url: 'https://example.com/submission.docx' },
    updateProgress: jest.fn(),
  };
  const submission = {
    id: 'submission-id',
    student: { id: 'student-id' },
    assignment: {
      id: 'assignment-id',
      title: 'Ensayo',
      rubric: { id: 'rubric-id' },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    submissionRepository.findOne.mockResolvedValue(submission);
    extractorService.extractTextFromUrl.mockResolvedValue('Contenido de la entrega');
    aiService.evaluateSubmission.mockResolvedValue({
      totalScore: 8,
      generalFeedback: 'Buen trabajo',
      detailedFeedback: {},
    });
    evaluationService.createDraft.mockResolvedValue({
      id: 'evaluation-id',
      totalScore: 8,
      origin: EvaluationOrigin.AI,
    });
    submissionRepository.increment.mockResolvedValue(undefined);
    submissionRepository.update.mockResolvedValue({ affected: 1 });
  });

  it('skips extraction and AI when a draft already exists', async () => {
    submissionRepository.findOne.mockResolvedValue({
      ...submission,
      evaluation: { id: 'evaluation-id', totalScore: 8 },
    });

    const result = await processor.process(job as never);

    expect(result).toEqual({
      evaluationId: 'evaluation-id',
      score: 8,
      status: 'DRAFT_ALREADY_EXISTS',
    });
    expect(job.updateProgress).toHaveBeenCalledWith(100);
    expect(submissionRepository.increment).not.toHaveBeenCalled();
    expect(extractorService.extractTextFromUrl).not.toHaveBeenCalled();
    expect(aiService.evaluateSubmission).not.toHaveBeenCalled();
  });

  it('notifies the actual submission owner when grading finishes', async () => {
    const result = await processor.process(job as never);

    expect(submissionRepository.increment).toHaveBeenCalledWith(
      { id: 'submission-id' },
      'gradingAttemptCount',
      1
    );
    expect(submissionRepository.update).toHaveBeenCalledWith('submission-id', {
      status: SubmissionStatus.IN_PROGRESS,
      gradingFailureReason: null,
      gradingLastAttemptAt: expect.any(Date),
    });
    expect(submissionRepository.update).toHaveBeenCalledWith('submission-id', {
      extractedText: 'Contenido de la entrega',
    });
    expect(evaluationService.createDraft).toHaveBeenCalledWith(
      expect.objectContaining({ submissionId: 'submission-id', totalScore: 8 })
    );
    expect(notificationsGateway.notifyStudent).toHaveBeenCalledWith('student-id', {
      submissionId: 'submission-id',
      status: 'DRAFT_SAVED',
    });
    expect(result.status).toBe('DRAFT_SAVED');
  });

  it('leaves the final FAILED state to the queue event after retries', async () => {
    extractorService.extractTextFromUrl.mockRejectedValue(new Error('Extractor unavailable'));

    await expect(processor.process(job as never)).rejects.toThrow('Extractor unavailable');

    expect(submissionRepository.update).not.toHaveBeenCalledWith('submission-id', {
      status: SubmissionStatus.FAILED,
    });
    expect(submissionRepository.increment).toHaveBeenCalledTimes(1);
    expect(submissionRepository.update).toHaveBeenCalledWith('submission-id', {
      status: SubmissionStatus.IN_PROGRESS,
      gradingFailureReason: null,
      gradingLastAttemptAt: expect.any(Date),
    });
  });

  it('stops before invoking AI when a manual draft appears during extraction', async () => {
    submissionRepository.findOne.mockResolvedValueOnce(submission).mockResolvedValueOnce({
      ...submission,
      evaluation: { id: 'manual-id', totalScore: 4, origin: EvaluationOrigin.MANUAL },
    });

    await expect(processor.process(job as never)).resolves.toEqual({
      evaluationId: 'manual-id',
      score: 4,
      status: 'DRAFT_ALREADY_EXISTS',
    });
    expect(aiService.evaluateSubmission).not.toHaveBeenCalled();
    expect(notificationsGateway.notifyStudent).not.toHaveBeenCalled();
  });

  it('does not announce an AI draft when manual grading wins the creation race', async () => {
    evaluationService.createDraft.mockResolvedValue({
      id: 'manual-id',
      totalScore: 4,
      origin: EvaluationOrigin.MANUAL,
    });

    await expect(processor.process(job as never)).resolves.toEqual({
      evaluationId: 'manual-id',
      score: 4,
      status: 'DRAFT_ALREADY_EXISTS',
    });
    expect(notificationsGateway.notifyStudent).not.toHaveBeenCalled();
  });
});
