import { RubricPerformanceLevel } from './enums';

export const RUBRIC_MAX_SCORE = 5;
export const RUBRIC_WEIGHT_TOTAL = 100;
export const RUBRIC_PROMPT_VERSION = 'rubric-copilot-v1';

export const RUBRIC_LEVEL_RANGES = [
  { label: RubricPerformanceLevel.EXCELENTE, minScore: 4.5, maxScore: 5 },
  { label: RubricPerformanceLevel.BUENO, minScore: 4, maxScore: 4.49 },
  { label: RubricPerformanceLevel.ACEPTABLE, minScore: 3, maxScore: 3.99 },
  { label: RubricPerformanceLevel.INSUFICIENTE, minScore: 0, maxScore: 2.99 },
] as const;
