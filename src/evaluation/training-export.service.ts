import { ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { UserRoles } from 'src/auth/enums';
import { redactPersonalData } from 'src/common/helpers/personal-data-redactor';
import { User } from 'src/user/entities/user.entity';
import { Evaluation } from './entities/evaluation.entity';
import {
  compareCriteria,
  delta,
  effectiveFinal,
  GradingHistoryService,
  num,
  rubricOf,
  Snapshot,
} from './grading-history.service';
import { toCsv } from './training-export.csv';

export type TrainingDataset = 'evaluations' | 'criteria' | 'jsonl';
export type TrainingExportOptions = {
  includeSubmissionText?: boolean;
  courseId?: string;
  /** On unless explicitly disabled. */
  redactPersonalData?: boolean;
};
type Pseudonym = (prefix: string, id: unknown) => string;
type Clean = (text: unknown) => string;

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

/**
 * Consolidated grading history for model training: what the draft proposed, what the teacher
 * published and any later correction. Reads only the immutable snapshots, so a rubric edited
 * afterwards cannot rewrite history.
 */
@Injectable()
export class TrainingExportService {
  constructor(
    private readonly history: GradingHistoryService,
    private readonly config: ConfigService
  ) {}

  async export(actor: User, dataset: TrainingDataset, options: TrainingExportOptions = {}) {
    if (actor.role !== UserRoles.Administrador || (!actor.isPlatformAdmin && !actor.institutionId))
      throw new ForbiddenException('Solo un administrador puede exportar este consolidado.');
    const secret =
      this.config.get<string>('TRAINING_EXPORT_PSEUDONYM_SECRET') ||
      this.config.get<string>('JWT_SECRET');
    if (!secret) throw new ServiceUnavailableException('La exportación no está configurada.');
    const pseudonym: Pseudonym = (prefix, id) =>
      typeof id === 'string' && id
        ? `${prefix}_${createHmac('sha256', secret).update(`${prefix}:${id}`).digest('hex').slice(0, 16)}`
        : '';
    const includeText = options.includeSubmissionText === true;
    const redact = options.redactPersonalData !== false;

    // A platform administrator consolidates every institution; anyone else only their own.
    const evaluations = await this.history.load({
      institutionId: actor.isPlatformAdmin ? undefined : actor.institutionId,
      courseId: options.courseId,
    });
    const cleanerFor = (evaluation: Evaluation): Clean => {
      if (!redact) return (text) => (typeof text === 'string' ? text : '');
      const student = evaluation.submission.student;
      const teacher = evaluation.submission.assignment.user;
      const names = [student?.name, student?.last_name, teacher?.name, teacher?.last_name];
      return (text) => redactPersonalData(text, names);
    };

    if (dataset === 'jsonl') {
      const lines = evaluations.map((evaluation) =>
        JSON.stringify(
          this.trainingExample(evaluation, pseudonym, cleanerFor(evaluation), includeText)
        )
      );
      return {
        content: lines.length ? `${lines.join('\n')}\n` : '',
        rows: lines.length,
        contentType: 'application/x-ndjson; charset=utf-8',
        extension: 'jsonl',
      };
    }
    const rows =
      dataset === 'criteria'
        ? evaluations.flatMap((evaluation) =>
            this.criteriaRows(evaluation, pseudonym, cleanerFor(evaluation))
          )
        : evaluations.map((evaluation) =>
            this.evaluationRow(evaluation, pseudonym, cleanerFor(evaluation), includeText)
          );
    const columns: string[] =
      dataset === 'criteria'
        ? [...CRITERIA_COLUMNS]
        : [...EVALUATION_COLUMNS, ...(includeText ? ['submission_text'] : [])];
    return {
      content: toCsv(columns, rows),
      rows: rows.length,
      contentType: 'text/csv; charset=utf-8',
      extension: 'csv',
    };
  }

  private evaluationRow(
    evaluation: Evaluation,
    pseudonym: Pseudonym,
    clean: Clean,
    includeSubmissionText: boolean
  ): Record<string, unknown> {
    const draft: Snapshot = evaluation.originalDraftSnapshot;
    const final: Snapshot = evaluation.teacherReviewSnapshot;
    const revision: Snapshot = evaluation.reevaluationRevisionSnapshot;
    const assignment = evaluation.submission.assignment;
    const rubric = rubricOf(evaluation);
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
      draft_general_feedback: clean(draft?.generalFeedback),
      published_at: final?.capturedAt ?? '',
      final_total_score: num(final?.totalScore),
      final_general_feedback: clean(final?.generalFeedback),
      score_delta: delta(final?.totalScore, draft?.totalScore),
      feedback_changed:
        (draft?.generalFeedback ?? '').trim() !== (final?.generalFeedback ?? '').trim(),
      adjustment_reason: final?.adjustment?.reason ?? '',
      adjustment_note: clean(final?.adjustment?.note),
      reevaluation_status: request?.status ?? '',
      reevaluation_reason: clean(request?.reason),
      reevaluation_teacher_response: clean(request?.teacherResponse),
      revised_at: revision?.capturedAt ?? '',
      revised_total_score: num(revision?.totalScore),
      revised_general_feedback: clean(revision?.generalFeedback),
      revision_adjustment_reason: revision?.adjustment?.reason ?? '',
      submission_content_hash: final?.context?.contentHash ?? draft?.context?.contentHash ?? '',
      ...(includeSubmissionText
        ? {
            submission_text: clean(final?.context?.extractedText ?? draft?.context?.extractedText),
          }
        : {}),
    };
  }

  private criteriaRows(
    evaluation: Evaluation,
    pseudonym: Pseudonym,
    clean: Clean
  ): Record<string, unknown>[] {
    const rubric = rubricOf(evaluation);
    return compareCriteria(evaluation).map((criterion) => ({
      evaluation_id: evaluation.id,
      student_pseudonym: pseudonym('stu', evaluation.submission.student?.id),
      assignment_id: evaluation.submission.assignment.id,
      rubric_id: rubric?.id ?? '',
      criterion_id: criterion.criterionId,
      criterion_title: criterion.title,
      criterion_description: criterion.description,
      criterion_weight: criterion.weight,
      draft_score: criterion.draftScore,
      draft_feedback: clean(criterion.draftFeedback),
      final_score: criterion.finalScore,
      final_feedback: clean(criterion.finalFeedback),
      score_delta: delta(criterion.finalScore, criterion.draftScore),
      revised_score: criterion.revisedScore,
      revised_feedback: clean(criterion.revisedFeedback),
    }));
  }

  /**
   * One supervised example per evaluation: what the grader saw (task, rubric, optionally the
   * submission) and the grade the teacher stood behind (the re-evaluation correction if any).
   */
  private trainingExample(
    evaluation: Evaluation,
    pseudonym: Pseudonym,
    clean: Clean,
    includeSubmissionText: boolean
  ) {
    const draft: Snapshot = evaluation.originalDraftSnapshot;
    const final = effectiveFinal(evaluation);
    const rubric = rubricOf(evaluation);
    const criteria = compareCriteria(evaluation);
    const revised = Boolean(evaluation.reevaluationRevisionSnapshot);
    return {
      input: {
        assignment_title:
          final?.context?.assignment?.title ?? evaluation.submission.assignment.title,
        rubric: {
          id: rubric?.id ?? null,
          title: rubric?.title ?? null,
          max_total_score: num(rubric?.maxTotalScore),
          criteria: (Array.isArray(rubric?.criteria) ? rubric.criteria : []).map(
            (criterion: Record<string, any>) => ({
              id: criterion.id,
              title: criterion.title,
              description: criterion.description ?? null,
              weight: num(criterion.weight),
              levels: criterion.levels ?? null,
            })
          ),
        },
        ...(includeSubmissionText
          ? {
              submission_text: clean(
                final?.context?.extractedText ?? draft?.context?.extractedText
              ),
            }
          : {}),
      },
      output: {
        total_score: num(final?.totalScore),
        general_feedback: clean(final?.generalFeedback),
        criteria: criteria.map((criterion) => ({
          criterion_id: criterion.criterionId,
          score:
            revised && criterion.revisedScore !== ''
              ? criterion.revisedScore
              : criterion.finalScore,
          feedback: clean(
            revised && criterion.revisedFeedback
              ? criterion.revisedFeedback
              : criterion.finalFeedback
          ),
        })),
      },
      draft: {
        origin: draft?.origin ?? evaluation.origin,
        ai_model: draft?.aiModelUsed ?? null,
        prompt_version: draft?.promptVersion ?? null,
        total_score: num(draft?.totalScore),
        general_feedback: clean(draft?.generalFeedback),
        criteria: criteria.map((criterion) => ({
          criterion_id: criterion.criterionId,
          score: criterion.draftScore,
          feedback: clean(criterion.draftFeedback),
        })),
      },
      meta: {
        evaluation_id: evaluation.id,
        student_pseudonym: pseudonym('stu', evaluation.submission.student?.id),
        course_id: evaluation.submission.assignment.course?.id ?? null,
        score_delta: delta(final?.totalScore, draft?.totalScore),
        adjustment_reason: final?.adjustment?.reason ?? null,
        revised_after_reevaluation: revised,
        submission_content_hash: final?.context?.contentHash ?? draft?.context?.contentHash ?? null,
      },
    };
  }
}
