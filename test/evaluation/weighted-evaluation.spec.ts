import { normalizeWeightedEvaluation } from 'src/evaluation/weighted-evaluation';

describe('weighted evaluation publication', () => {
  it('rounds once at the final total so three perfect fractional weights remain 5.00', () => {
    const criteria = [33.33, 33.33, 33.34].map((weight, index) => ({
      id: String(index),
      title: String(index),
      weight,
    }));
    const result = normalizeWeightedEvaluation(
      criteria.map((c) => ({ criteriaId: c.id, score: 5 })),
      criteria
    );
    expect(result.totalScore).toBe(5);
  });
  it('does not lose fractional contributions when scores are below the maximum', () => {
    const criteria = [33.33, 33.33, 33.34].map((weight, index) => ({
      id: String(index),
      title: String(index),
      weight,
    }));
    const result = normalizeWeightedEvaluation(
      criteria.map((c) => ({ criteriaId: c.id, score: 4 })),
      criteria
    );
    expect(result.totalScore).toBe(4);
  });
  it('uses stable IDs rather than ambiguous repeated criterion names', () => {
    const criteria = [
      { id: 'a', title: 'Igual', weight: 50 },
      { id: 'b', title: 'Igual', weight: 50 },
    ];
    expect(() =>
      normalizeWeightedEvaluation(
        [
          { name: 'Igual', score: 4 },
          { name: 'Igual', score: 3 },
        ],
        criteria
      )
    ).toThrow();
    expect(
      normalizeWeightedEvaluation(
        [
          { criteriaId: 'a', score: 4 },
          { criterionId: 'b', score: 3 },
        ],
        criteria
      ).totalScore
    ).toBe(3.5);
  });
});
