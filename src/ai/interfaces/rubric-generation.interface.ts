import { RubricAcademicLevel, RubricPerformanceLevel } from 'src/rubric/enums';

export type GenerateRubricRequest = {
  title: string;
  taskDescription: string;
  academicLevel: RubricAcademicLevel;
  criterionCount?: number;
  additionalInstructions?: string;
};

export type GeneratedRubricLevel = {
  label: RubricPerformanceLevel;
  minScore: number;
  maxScore: number;
  description: string;
};

export type GeneratedRubricCriterion = {
  title: string;
  description: string;
  weight: number;
  levels: GeneratedRubricLevel[];
};

export type GeneratedRubric = {
  title: string;
  description: string;
  academicLevel: RubricAcademicLevel;
  criteria: GeneratedRubricCriterion[];
  model?: string;
  promptVersion?: string;
  generationToken?: string;
};
