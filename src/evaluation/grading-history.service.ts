import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EvaluationStatus } from 'src/enums';
import { Evaluation } from './entities/evaluation.entity';

export type Snapshot = Record<string, any> | null | undefined;
export type HistoryScope = {
  institutionId?: string;
  courseId?: string;
  teacherId?: string;
  rubricId?: string;
  newestFirst?: boolean;
  limit?: number;
};
export type CriterionComparison = {
  criterionId: string;
  title: string;
  description: string;
  weight: number | '';
  draftScore: number | '';
  draftFeedback: string;
  finalScore: number | '';
  finalFeedback: string;
  revisedScore: number | '';
  revisedFeedback: string;
};

export const num = (value: unknown): number | '' =>
  value === null || value === undefined || value === '' || !Number.isFinite(Number(value))
    ? ''
    : Number(value);
export const delta = (final: unknown, draft: unknown): number | '' =>
  num(final) === '' || num(draft) === '' ? '' : Number((Number(final) - Number(draft)).toFixed(2));

const items = (snapshot: Snapshot) =>
  new Map<string, { score?: number; feedback?: string }>(
    (Array.isArray(snapshot?.detailedFeedback) ? snapshot.detailedFeedback : []).map(
      (item: Record<string, any>) => [
        item?.criteriaId ?? item?.criterionId,
        { score: item?.score, feedback: item?.feedback ?? item?.observations },
      ]
    )
  );

/** The rubric as it was when the grade was published, never the one edited afterwards. */
export const rubricOf = (evaluation: Evaluation): Snapshot =>
  (evaluation.teacherReviewSnapshot as Snapshot)?.context?.rubric ??
  (evaluation.originalDraftSnapshot as Snapshot)?.context?.rubric;

/** What the student finally received: the re-evaluation correction when there is one. */
export const effectiveFinal = (evaluation: Evaluation): Snapshot =>
  (evaluation.reevaluationRevisionSnapshot as Snapshot) ??
  (evaluation.teacherReviewSnapshot as Snapshot);

export function compareCriteria(evaluation: Evaluation): CriterionComparison[] {
  const rubric = rubricOf(evaluation);
  const [drafts, finals, revisions] = [
    items(evaluation.originalDraftSnapshot),
    items(evaluation.teacherReviewSnapshot),
    items(evaluation.reevaluationRevisionSnapshot),
  ];
  const criteria: Record<string, any>[] = Array.isArray(rubric?.criteria) ? rubric.criteria : [];
  return criteria.map((criterion) => ({
    criterionId: criterion.id,
    title: criterion.title ?? '',
    description: criterion.description ?? '',
    weight: num(criterion.weight),
    draftScore: num(drafts.get(criterion.id)?.score),
    draftFeedback: drafts.get(criterion.id)?.feedback ?? '',
    finalScore: num(finals.get(criterion.id)?.score),
    finalFeedback: finals.get(criterion.id)?.feedback ?? '',
    revisedScore: num(revisions.get(criterion.id)?.score),
    revisedFeedback: revisions.get(criterion.id)?.feedback ?? '',
  }));
}

/** Published evaluations that kept both the original draft and the teacher's version. */
@Injectable()
export class GradingHistoryService {
  constructor(@InjectRepository(Evaluation) private readonly evaluations: Repository<Evaluation>) {}

  load(scope: HistoryScope = {}): Promise<Evaluation[]> {
    const direction = scope.newestFirst ? 'DESC' : 'ASC';
    const query = this.evaluations
      .createQueryBuilder('e')
      .innerJoinAndSelect('e.submission', 's')
      .innerJoinAndSelect('s.student', 'student')
      .innerJoinAndSelect('s.assignment', 'a')
      .innerJoinAndSelect('a.user', 'teacher')
      .leftJoinAndSelect('a.course', 'course')
      .leftJoinAndSelect('a.rubric', 'rubric')
      .leftJoinAndSelect('e.reevaluationRequest', 'r')
      .where('e.status = :status', { status: EvaluationStatus.PUBLISHED })
      .andWhere('e.originalDraftSnapshot IS NOT NULL')
      .andWhere('e.teacherReviewSnapshot IS NOT NULL')
      .orderBy('e.createdAt', direction)
      .addOrderBy('e.id', direction);
    if (scope.institutionId)
      query.andWhere('teacher.institutionId = :institutionId', {
        institutionId: scope.institutionId,
      });
    if (scope.courseId) query.andWhere('course.id = :courseId', { courseId: scope.courseId });
    if (scope.teacherId) query.andWhere('teacher.id = :teacherId', { teacherId: scope.teacherId });
    if (scope.rubricId) query.andWhere('rubric.id = :rubricId', { rubricId: scope.rubricId });
    if (scope.limit) query.take(scope.limit);
    return query.getMany();
  }
}
