import { BadRequestException } from '@nestjs/common';

type WeightedCriterion = { id: string; title: string; weight: number };

/** Only rubric-owned identifiers and weights determine the published result. */
export function normalizeWeightedEvaluation(raw: unknown, criteria: WeightedCriterion[]) {
  if (!criteria.length)
    throw new BadRequestException('La rúbrica no contiene criterios ponderados.');
  if (!Array.isArray(raw))
    throw new BadRequestException('La evaluación debe incluir el detalle por criterio.');
  const weights = criteria.map((criterion) => Number(criterion.weight));
  if (
    weights.some((weight) => !Number.isFinite(weight) || weight <= 0) ||
    Math.abs(weights.reduce((sum, weight) => sum + weight, 0) - 100) > 0.01
  )
    throw new BadRequestException('Los pesos de la rúbrica deben ser positivos y sumar 100%.');

  const matched = new Map<string, Record<string, unknown>>();
  for (const value of raw) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new BadRequestException('El detalle por criterio es inválido.');
    const item = value as Record<string, unknown>;
    const ids = [item.criteriaId, item.criterionId].filter((id) => id !== undefined);
    if (ids.some((id) => typeof id !== 'string' || !id) || new Set(ids).size > 1)
      throw new BadRequestException('El identificador del criterio es inválido.');
    const title = item.name ?? item.criterion;
    const candidates = ids.length
      ? criteria.filter((criterion) => criterion.id === ids[0])
      : criteria.filter(
          (criterion) =>
            typeof title === 'string' &&
            criterion.title.trim().toLocaleLowerCase('es') === title.trim().toLocaleLowerCase('es')
        );
    if (candidates.length !== 1 || matched.has(candidates[0].id))
      throw new BadRequestException('Hay criterios desconocidos, ambiguos o repetidos.');
    matched.set(candidates[0].id, item);
  }
  const items = criteria.map((criterion, index) => {
    const item = matched.get(criterion.id);
    if (!item)
      throw new BadRequestException(`Falta la calificación del criterio “${criterion.title}”.`);
    if (
      typeof item.score !== 'number' ||
      !Number.isFinite(item.score) ||
      item.score < 0 ||
      item.score > 5
    )
      throw new BadRequestException(
        `La puntuación de “${criterion.title}” debe estar entre 0.0 y 5.0.`
      );
    const score = Number(item.score.toFixed(2));
    const feedback = item.feedback ?? item.observations ?? '';
    if (typeof feedback !== 'string' || feedback.length > 3000)
      throw new BadRequestException(
        `El comentario de “${criterion.title}” debe ser texto de hasta 3000 caracteres.`
      );
    return {
      criteriaId: criterion.id,
      name: criterion.title,
      score,
      weight: weights[index],
      weightedContribution: Number(((score * weights[index]) / 100).toFixed(2)),
      feedback: feedback.trim(),
    };
  });
  return {
    totalScore: Number(
      items.reduce((sum, item) => sum + (item.score * item.weight) / 100, 0).toFixed(2)
    ),
    items,
  };
}
