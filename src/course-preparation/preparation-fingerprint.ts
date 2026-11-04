import { createHash } from 'node:crypto';
import type { Assignment } from '../assignment/entities/assignment.entity';

export function activityFingerprint(assignment: Assignment): string {
  const rubric = assignment.rubric;
  const data = {
    id: assignment.id,
    courseId: assignment.course.id,
    title: assignment.title,
    description: assignment.description,
    dueDate: new Date(assignment.dueDate).toISOString(),
    rubric: {
      id: rubric.id,
      title: rubric.title,
      description: rubric.description ?? '',
      version: rubric.version,
      status: rubric.status,
      academicLevel: rubric.academicLevel,
      maxTotalScore: Number(rubric.maxTotalScore),
      criteria: [...(rubric.criteria ?? [])]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((c) => ({
          id: c.id,
          title: c.title,
          description: c.description ?? '',
          weight: Number(c.weight),
          maxPoints: Number(c.maxPoints ?? 0),
          sortOrder: c.sortOrder ?? 0,
          levels: (c.levels ?? []).map((l) => ({
            label: l.label,
            description: l.description,
            minScore: Number(l.minScore),
            maxScore: Number(l.maxScore),
            score: Number(l.score),
          })),
        })),
    },
  };
  return createHash('sha256').update(JSON.stringify(data)).digest('hex');
}
