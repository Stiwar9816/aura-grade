import { ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac } from 'crypto';
import { Repository } from 'typeorm';
import { UserRoles } from 'src/auth/enums';
import { EvaluationStatus } from 'src/enums';
import { User } from 'src/user/entities/user.entity';
import { Evaluation } from './entities/evaluation.entity';
import { toCsv } from './training-export.csv';

export type TrainingDataset = 'evaluations' | 'criteria';
type Snapshot = Record<string, any> | null | undefined;
type CriterionItem = { criteriaId?: string; score?: number; feedback?: string };

export const EVALUATION_COLUMNS = [
  'evaluation_id',
  'institution_id',
  'course_id',
  'course_name',
  'assignment_id',
  'assignment_title',
  'rubric_id',
  'rubric_title',
  'max_total_score',
  'student_pseudonym',
  'reviewer_pseudonym',
  'origin',
  'ai_model',
  'prompt_version',
  'draft_stage',
  'draft_captured_at',
  'draft_total_score',
  'draft_general_feedback',
  'published_at',
  'final_total_score',
  'final_general_feedback',
  'score_delta',
  'feedback_changed',
  'adjustment_reason',
  'adjustment_note',
  'reevaluation_status',
  'reevaluation_reason',
  'reevaluation_teacher_response',
  'revised_at',
  'revised_total_score',
  'revised_general_feedback',
  'revision_adjustment_reason',
  'submission_content_hash',
] as const;

export const CRITERIA_COLUMNS = [
  'evaluation_id',
  'student_pseudonym',
  'assignment_id',
  'rubric_id',
  'criterion_id',
  'criterion_title',
  'criterion_description',
  'criterion_weight',
  'draft_score',
  'draft_feedback',
  'final_score',
  'final_feedback',
  'score_delta',
  'revised_score',
  'revised_feedback',
] as const;

const num = (value: unknown): number | '' =>
  value === null || value === undefined || !Number.isFinite(Number(value)) ? '' : Number(value);
const delta = (final: unknown, draft: unknown): number | '' =>
  num(final) === '' || num(draft) === '' ? '' : Number((Number(final) - Number(draft)).toFixed(2));
const items = (snapshot: Snapshot): CriterionItem[] =>
  Array.isArray(snapshot?.detailedFeedback)
    ? snapshot.detailedFeedback.map((item: Record<string, any>) => ({
        criteriaId: item?.criteriaId ?? item?.criterionId,
        score: item?.score,
        feedback: item?.feedback ?? item?.observations,
      }))
    : [];

/**
 * Consolidated grading history for model training: what the draft proposed, what the teacher
 * published and any later correction. Reads only the immutable snapshots, so a rubric edited
 * afterwards cannot rewrite history.
 */
@Injectable()
export class TrainingExportService {
  constructor(
    @InjectRepository(Evaluation) private readonly evaluations: Repository<Evaluation>,
    private readonly config: ConfigService
  ) {}

  async export(actor: User, dataset: TrainingDataset, includeSubmissionText = false) {
    if (actor.role !== UserRoles.Administrador || (!actor.isPlatformAdmin && !actor.institutionId))
      throw new ForbiddenException('Solo un administrador puede exportar este consolidado.');
    const secret =
      this.config.get<string>('TRAINING_EXPORT_PSEUDONYM_SECRET') ||
      this.config.get<string>('JWT_SECRET');
    if (!secret) throw new ServiceUnavailableException('La exportación no está configurada.');
    const pseudonym = (prefix: string, id: unknown) =>
      typeof id === 'string' && id
        ? `${prefix}_${createHmac('sha256', secret).update(`${prefix}:${id}`).digest('hex').slice(0, 16)}`
        : '';

    const query = this.evaluations
      .createQueryBuilder('e')
      .innerJoinAndSelect('e.submission', 's')
      .innerJoinAndSelect('s.student', 'student')
      .innerJoinAndSelect('s.assignment', 'a')
      .innerJoinAndSelect('a.user', 'teacher')
      .leftJoinAndSelect('a.course', 'course')
      .leftJoinAndSelect('e.reevaluationRequest', 'r')
      // Only complete pairs are useful: rows published before snapshots existed are skipped.
      .where('e.status = :status', { status: EvaluationStatus.PUBLISHED })
      .andWhere('e.originalDraftSnapshot IS NOT NULL')
      .andWhere('e.teacherReviewSnapshot IS NOT NULL')
      .orderBy('e.createdAt', 'ASC')
      .addOrderBy('e.id', 'ASC');
    // A platform administrator consolidates every institution; anyone else only their own.
    if (!actor.isPlatformAdmin)
      query.andWhere('teacher.institutionId = :institutionId', {
        institutionId: actor.institutionId,
      });
    const evaluations = await query.getMany();

    const rows =
      dataset === 'criteria'
        ? evaluations.flatMap((evaluation) => this.criteriaRows(evaluation, pseudonym))
        : evaluations.map((evaluation) =>
            this.evaluationRow(evaluation, pseudonym, includeSubmissionText)
          );
    const columns: string[] =
      dataset === 'criteria'
        ? [...CRITERIA_COLUMNS]
        : [...EVALUATION_COLUMNS, ...(includeSubmissionText ? ['submission_text'] : [])];
    return { csv: toCsv(columns, rows), rows: rows.length };
  }

  private evaluationRow(
    evaluation: Evaluation,
    pseudonym: (prefix: string, id: unknown) => string,
    includeSubmissionText: boolean
  ): Record<string, unknown> {
    const draft: Snapshot = evaluation.originalDraftSnapshot;
    const final: Snapshot = evaluation.teacherReviewSnapshot;
    const revision: Snapshot = evaluation.reevaluationRevisionSnapshot;
    const assignment = evaluation.submission.assignment;
    const rubric = final?.context?.rubric ?? draft?.context?.rubric;
    const request = evaluation.reevaluationRequest;
    return {
      evaluation_id: evaluation.id,
      institution_id: assignment.user?.institutionId ?? '',
      course_id: assignment.course?.id ?? '',
      course_name: assignment.course?.course_name ?? '',
      assignment_id: assignment.id,
      assignment_title: final?.context?.assignment?.title ?? assignment.title,
      rubric_id: rubric?.id ?? '',
      rubric_title: rubric?.title ?? '',
      max_total_score: num(rubric?.maxTotalScore),
      student_pseudonym: pseudonym('stu', evaluation.submission.student?.id),
      reviewer_pseudonym: pseudonym('tch', final?.reviewerId),
      origin: draft?.origin ?? evaluation.origin,
      ai_model: draft?.aiModelUsed ?? '',
      prompt_version: draft?.promptVersion ?? '',
      draft_stage: draft?.captureStage ?? '',
      draft_captured_at: draft?.capturedAt ?? '',
      draft_total_score: num(draft?.totalScore),
      draft_general_feedback: draft?.generalFeedback ?? '',
      published_at: final?.capturedAt ?? '',
      final_total_score: num(final?.totalScore),
      final_general_feedback: final?.generalFeedback ?? '',
      score_delta: delta(final?.totalScore, draft?.totalScore),
      feedback_changed:
        (draft?.generalFeedback ?? '').trim() !== (final?.generalFeedback ?? '').trim(),
      adjustment_reason: final?.adjustment?.reason ?? '',
      adjustment_note: final?.adjustment?.note ?? '',
      reevaluation_status: request?.status ?? '',
      reevaluation_reason: request?.reason ?? '',
      reevaluation_teacher_response: request?.teacherResponse ?? '',
      revised_at: revision?.capturedAt ?? '',
      revised_total_score: num(revision?.totalScore),
      revised_general_feedback: revision?.generalFeedback ?? '',
      revision_adjustment_reason: revision?.adjustment?.reason ?? '',
      submission_content_hash: final?.context?.contentHash ?? draft?.context?.contentHash ?? '',
      ...(includeSubmissionText
        ? { submission_text: final?.context?.extractedText ?? draft?.context?.extractedText ?? '' }
        : {}),
    };
  }

  private criteriaRows(
    evaluation: Evaluation,
    pseudonym: (prefix: string, id: unknown) => string
  ): Record<string, unknown>[] {
    const draft: Snapshot = evaluation.originalDraftSnapshot;
    const final: Snapshot = evaluation.teacherReviewSnapshot;
    const revision: Snapshot = evaluation.reevaluationRevisionSnapshot;
    const rubric = final?.context?.rubric ?? draft?.context?.rubric;
    const byId = (snapshot: Snapshot) =>
      new Map(items(snapshot).map((item) => [item.criteriaId, item]));
    const [drafts, finals, revisions] = [byId(draft), byId(final), byId(revision)];
    const criteria: Record<string, any>[] = Array.isArray(rubric?.criteria) ? rubric.criteria : [];
    return criteria.map((criterion) => {
      const d = drafts.get(criterion.id);
      const f = finals.get(criterion.id);
      const r = revisions.get(criterion.id);
      return {
        evaluation_id: evaluation.id,
        student_pseudonym: pseudonym('stu', evaluation.submission.student?.id),
        assignment_id: evaluation.submission.assignment.id,
        rubric_id: rubric?.id ?? '',
        criterion_id: criterion.id,
        criterion_title: criterion.title ?? '',
        criterion_description: criterion.description ?? '',
        criterion_weight: num(criterion.weight),
        draft_score: num(d?.score),
        draft_feedback: d?.feedback ?? '',
        final_score: num(f?.score),
        final_feedback: f?.feedback ?? '',
        score_delta: delta(f?.score, d?.score),
        revised_score: num(r?.score),
        revised_feedback: r?.feedback ?? '',
      };
    });
  }
}
