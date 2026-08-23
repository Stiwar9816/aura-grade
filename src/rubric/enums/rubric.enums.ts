import { registerEnumType } from '@nestjs/graphql';

export enum RubricAcademicLevel {
  UNIVERSITARIO = 'UNIVERSITARIO',
  POSGRADO = 'POSGRADO',
}

export enum RubricStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

export enum RubricSource {
  MANUAL = 'MANUAL',
  AI = 'AI',
}

export enum RubricPerformanceLevel {
  EXCELENTE = 'Excelente',
  BUENO = 'Bueno',
  ACEPTABLE = 'Aceptable',
  INSUFICIENTE = 'Insuficiente',
}

registerEnumType(RubricAcademicLevel, {
  name: 'RubricAcademicLevel',
  description: 'Nivel académico para el que se diseñó la rúbrica.',
});

registerEnumType(RubricStatus, {
  name: 'RubricStatus',
  description: 'Ciclo de vida de una versión de rúbrica.',
});

registerEnumType(RubricSource, {
  name: 'RubricSource',
  description: 'Origen inicial de la versión de rúbrica.',
});
