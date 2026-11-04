import { normalizePilotWeights } from '../../scripts/course-pilot/weights';

describe('approved draft rubric normalization', () => {
  it('preserves valid official weights exactly', () => {
    expect(normalizePilotWeights([20, 25, 25, 15, 15])).toEqual([20, 25, 25, 15, 15]);
  });
  it('normalizes 105 percent with deterministic rounding to exactly 100', () => {
    const result = normalizePilotWeights([20, 25, 20, 15, 25]);
    expect(result).toEqual([19.05, 23.81, 19.05, 14.28, 23.81]);
    expect(result.reduce((sum, w) => sum + Math.round(w * 100), 0)).toBe(10000);
  });
  it('normalizes 125 percent proportionally', () => {
    expect(normalizePilotWeights([15, 25, 25, 20, 15, 25])).toEqual([12, 20, 20, 16, 12, 20]);
  });
  it.each([[], [0, 20], [-5, 100], [NaN, 100]].map((weights) => ({ weights })))(
    'rejects missing or invalid source weights $weights',
    ({ weights }) => {
      expect(() => normalizePilotWeights(weights)).toThrow();
    }
  );
});
