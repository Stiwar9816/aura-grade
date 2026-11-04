import { activityFingerprint } from 'src/course-preparation/preparation-fingerprint';
import type { Assignment } from 'src/assignment/entities/assignment.entity';
const fixture = () =>
  ({
    id: 'a',
    title: 'Actividad',
    description: 'Instrucciones',
    dueDate: new Date('2026-12-01'),
    course: { id: 'c' },
    rubric: {
      id: 'r',
      title: 'Rúbrica',
      version: 1,
      maxTotalScore: 5,
      criteria: [
        { id: 'b', title: 'B', weight: 60, levels: [] },
        { id: 'a', title: 'A', weight: 40, levels: [] },
      ],
    },
  }) as Assignment;
describe('activity coherence fingerprint', () => {
  it('identifies academic changes but ignores criterion query order and extensions', () => {
    const a = fixture();
    const hash = activityFingerprint(a);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    a.rubric.criteria.reverse();
    expect(activityFingerprint(a)).toBe(hash);
    a.extensions = [];
    expect(activityFingerprint(a)).toBe(hash);
    a.dueDate = new Date('2026-12-02');
    expect(activityFingerprint(a)).not.toBe(hash);
  });
  it.each(['title', 'description'])('invalidates changed %s', (key) => {
    const a = fixture();
    const before = activityFingerprint(a);
    a[key] += ' nuevo';
    expect(activityFingerprint(a)).not.toBe(before);
  });
  it('invalidates changed rubric criteria', () => {
    const a = fixture();
    const hash = activityFingerprint(a);
    a.rubric.criteria[0].weight = 50;
    expect(activityFingerprint(a)).not.toBe(hash);
  });
});
