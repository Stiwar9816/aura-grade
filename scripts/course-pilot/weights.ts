/** Largest-remainder rounding keeps proportional weights at exactly 100.00%. */
export function normalizePilotWeights(weights: number[]): number[] {
  if (!weights.length || weights.some((w) => !Number.isFinite(w) || w <= 0))
    throw new Error('La fuente requiere pesos positivos y explícitos.');
  const total = weights.reduce((sum, w) => sum + w, 0);
  const exact = weights.map((w) => (w / total) * 10000);
  const cents = exact.map(Math.floor);
  const order = exact
    .map((w, i) => ({ i, remainder: w - cents[i] }))
    .sort((a, b) => b.remainder - a.remainder || a.i - b.i);
  const remaining = 10000 - cents.reduce((sum, w) => sum + w, 0);
  for (let i = 0; i < remaining; i++) cents[order[i].i]++;
  return cents.map((w) => w / 100);
}
