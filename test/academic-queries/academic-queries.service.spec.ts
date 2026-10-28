import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AcademicQueriesService } from 'src/academic-queries/academic-queries.service';

describe('authorized academic queries', () => {
  const db = { query: jest.fn() };
  const access = { runForStudentCourse: jest.fn() };
  let service: AcademicQueriesService;
  beforeEach(() => {
    jest.resetAllMocks();
    access.runForStudentCourse.mockImplementation(async (studentId, courseId, operation) =>
      operation({ studentId, courseId, institutionId: 'institution' })
    );
    service = new AcademicQueriesService(db as never, access as never);
  });

  it('denies access before reading personal data', async () => {
    access.runForStudentCourse.mockRejectedValue(new ForbiddenException());
    await expect(service.activities('student', 'course', {})).rejects.toThrow(ForbiddenException);
    await expect(service.result('student', 'course', 'activity')).rejects.toThrow(
      ForbiddenException
    );
    expect(db.query).not.toHaveBeenCalled();
  });

  it('returns an explicit empty page without guessing activities', async () => {
    db.query.mockResolvedValueOnce([{ total: 0 }]).mockResolvedValueOnce([]);
    expect(await service.activities('student', 'course', {})).toEqual({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
    });
  });

  it('only exposes activity and own delivery metadata', async () => {
    db.query.mockResolvedValueOnce([{ total: 1 }]).mockResolvedValueOnce([
      {
        id: 'activity',
        title: 'Actividad',
        description: 'Instrucciones',
        dueDate: '2026-12-01',
        effectiveDueDate: '2026-12-03',
        submissionId: 'submission',
        submittedAt: '2026-11-30',
        submissionStatus: 'REVIEW_PENDING',
        cloudinaryPublicId: 'private',
      },
    ]);
    const response = await service.activities('student', 'course', {});
    expect(response.items[0]).toEqual({
      id: 'activity',
      title: 'Actividad',
      description: 'Instrucciones',
      dueDate: '2026-12-01',
      effectiveDueDate: '2026-12-03',
      submission: { id: 'submission', submittedAt: '2026-11-30', status: 'REVIEW_PENDING' },
    });
    expect(response).not.toHaveProperty('cloudinaryPublicId');
  });

  it('reports no submission and hides unpublished feedback', async () => {
    db.query.mockResolvedValue([{ id: 'activity', title: 'Actividad', evaluationId: null }]);
    expect(await service.result('student', 'course', 'activity')).toEqual({
      assignment: { id: 'activity', title: 'Actividad' },
      submission: null,
      evaluation: null,
      state: 'NOT_SUBMITTED',
    });
    db.query.mockResolvedValue([
      {
        id: 'activity',
        title: 'Actividad',
        submissionId: 's',
        submissionStatus: 'REVIEW_PENDING',
        evaluationId: null,
        generalFeedback: 'internal draft',
        totalScore: 4,
      },
    ]);
    const result = await service.result('student', 'course', 'activity');
    expect(result.state).toBe('AWAITING_PUBLICATION');
    expect(result.evaluation).toBeNull();
    expect(JSON.stringify(result)).not.toContain('internal draft');
  });

  it('preserves published zero scores and allowlists feedback fields', async () => {
    db.query.mockResolvedValue([
      {
        id: 'activity',
        title: 'Actividad',
        submissionId: 's',
        submissionStatus: 'PUBLISHED',
        evaluationId: 'e',
        totalScore: '0.00',
        generalFeedback: 'Revisar',
        detailedFeedback: [
          { criteriaId: 'c', score: 0, observations: 'Corregir', secret: 'never' },
        ],
        originalDraftSnapshot: { secret: 'never' },
        extractedText: 'private submission',
      },
    ]);
    const result = await service.result('student', 'course', 'activity');
    expect(result.state).toBe('PUBLISHED');
    expect(result.evaluation).toEqual({
      id: 'e',
      totalScore: 0,
      generalFeedback: 'Revisar',
      criteria: [{ criterionId: 'c', score: 0, feedback: 'Corregir' }],
    });
    expect(JSON.stringify(result)).not.toMatch(/never|private submission|originalDraftSnapshot/);
  });

  it('uses the authorized context instead of caller-supplied identity after authorization', async () => {
    access.runForStudentCourse.mockImplementation(async (_student, _course, operation) =>
      operation({ studentId: 'authorized-student', courseId: 'authorized-course' })
    );
    db.query.mockResolvedValue([]);
    await expect(service.result('student', 'course', 'activity')).rejects.toThrow(
      NotFoundException
    );
    expect(db.query.mock.calls[0][1]).toEqual([
      'authorized-student',
      'authorized-course',
      'activity',
    ]);
  });

  it('does not distinguish a foreign or inactive assignment from a missing assignment', async () => {
    db.query.mockResolvedValue([]);
    await expect(service.result('student', 'course', 'foreign')).rejects.toThrow(NotFoundException);
  });
});
