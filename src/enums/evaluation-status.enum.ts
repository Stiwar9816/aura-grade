import { registerEnumType } from '@nestjs/graphql';

export enum EvaluationStatus {
  DRAFT = 'DRAFT', // IA terminó, borrador para revisión
  PUBLISHED = 'PUBLISHED', // Confirmado por docente y visible para el estudiante
}

registerEnumType(EvaluationStatus, {
  name: 'EvaluationStatus',
  description: 'Publicaton status of an evaluation',
});
