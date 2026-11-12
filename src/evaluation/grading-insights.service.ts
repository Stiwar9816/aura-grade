import { ForbiddenException, Injectable } from '@nestjs/common';
import { UserRoles } from 'src/auth/enums';
import { User } from 'src/user/entities/user.entity';
import { Evaluation } from './entities/evaluation.entity';
import {
  compareCriteria,
  delta,
  effectiveFinal,
  GradingHistoryService,
  rubricOf,
  Snapshot,
} from './grading-history.service';

type Bucket = { label: string; n: number; abs: number; signed: number; unchanged: number };
const bucket = (label: string): Bucket => ({ label, n: 0, abs: 0, signed: 0, unchanged: 0 });
const add = (target: Bucket, change: number) => {
  target.n += 1;
  target.abs += Math.abs(change);
  target.signed += change;
  if (change === 0) target.unchanged += 1;
};
const view = (id: string, value: Bucket) => ({
  id,
  label: value.label,
  evaluations: value.n,
  // How far the draft was from the teacher's grade, on the 0-5 scale.
  meanAbsoluteDifference: Number((value.abs / value.n).toFixed(2)),
  // Positive: the teacher graded higher than the draft (the AI was too strict).
  meanSignedDifference: Number((value.signed / value.n).toFixed(2)),
  unchangedRate: Number((value.unchanged / value.n).toFixed(3)),
});
const sorted = (map: Map<string, Bucket>) =>
  [...map.entries()]
    .map(([id, value]) => view(id, value))
    .sort((a, b) => b.evaluations - a.evaluations);
const into = (map: Map<string, Bucket>, id: string, label: string, change: number) => {
  if (!map.has(id)) map.set(id, bucket(label));
  add(map.get(id)!, change);
};

/** How close AI drafts were to what teachers published, and where they differ most. */
@Injectable()
export class GradingInsightsService {
  constructor(private readonly history: GradingHistoryService) {}

  async summary(actor: User, courseId?: string) {
    if (actor.role !== UserRoles.Administrador || (!actor.isPlatformAdmin && !actor.institutionId))
      throw new ForbiddenException('Solo un administrador puede consultar este panel.');
    const evaluations = await this.history.load({
      institutionId: actor.isPlatformAdmin ? undefined : actor.institutionId,
      courseId,
    });
    const overall = bucket('Total');
    const byCourse = new Map<string, Bucket>();
    const byRubric = new Map<string, Bucket>();
    const byCriterion = new Map<string, Bucket>();
    const byPrompt = new Map<string, Bucket & { reevaluations: number }>();
    const reasons = new Map<string, number>();
    let aiDrafts = 0;
    let reevaluations = 0;

    for (const evaluation of evaluations as Evaluation[]) {
      const draft = evaluation.originalDraftSnapshot as Snapshot;
      if ((draft?.origin ?? evaluation.origin) !== 'AI') continue; // manual drafts say nothing about the AI
      const final = effectiveFinal(evaluation);
      const change = delta(final?.totalScore, draft?.totalScore);
      if (change === '') continue;
      aiDrafts += 1;
      add(overall, change);
      const assignment = evaluation.submission.assignment;
      const rubric = rubricOf(evaluation);
      into(
        byCourse,
        assignment.course?.id ?? 'sin-curso',
        assignment.course?.course_name ?? 'Sin curso',
        change
      );
      into(byRubric, rubric?.id ?? 'sin-rubrica', rubric?.title ?? 'Sin rúbrica', change);

      const promptKey = `${draft?.promptVersion ?? 'sin-version'} · ${draft?.aiModelUsed ?? 'modelo desconocido'}`;
      if (!byPrompt.has(promptKey))
        byPrompt.set(promptKey, { ...bucket(promptKey), reevaluations: 0 });
      const prompt = byPrompt.get(promptKey)!;
      add(prompt, change);
      if (evaluation.reevaluationRequest) {
        prompt.reevaluations += 1;
        reevaluations += 1;
      }

      for (const criterion of compareCriteria(evaluation)) {
        const score = criterion.revisedScore !== '' ? criterion.revisedScore : criterion.finalScore;
        const criterionChange = delta(score, criterion.draftScore);
        if (criterionChange === '') continue;
        into(
          byCriterion,
          `${rubric?.id ?? ''}:${criterion.criterionId}`,
          `${rubric?.title ?? 'Rúbrica'} — ${criterion.title}`,
          criterionChange
        );
      }
      for (const reason of [
        (evaluation.teacherReviewSnapshot as Snapshot)?.adjustment?.reason,
        (evaluation.reevaluationRevisionSnapshot as Snapshot)?.adjustment?.reason,
      ])
        if (typeof reason === 'string') reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
    }

    return {
      generatedAt: new Date().toISOString(),
      evaluations: aiDrafts,
      reevaluationRate: aiDrafts ? Number((reevaluations / aiDrafts).toFixed(3)) : 0,
      overall: aiDrafts ? view('total', overall) : null,
      byCourse: sorted(byCourse),
      byRubric: sorted(byRubric),
      byCriterion: sorted(byCriterion),
      byPromptVersion: [...byPrompt.entries()]
        .map(([id, value]) => ({
          ...view(id, value),
          reevaluationRate: Number((value.reevaluations / value.n).toFixed(3)),
        }))
        .sort((a, b) => b.evaluations - a.evaluations),
      adjustmentReasons: [...reasons.entries()]
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count),
    };
  }
}
