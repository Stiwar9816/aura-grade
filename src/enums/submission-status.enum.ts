import { registerEnumType } from '@nestjs/graphql';

export enum SubmissionStatus {
  PENDING = 'PENDING', // Entregado, esperando procesamiento
  IN_PROGRESS = 'IN_PROGRESS', // La IA está calificando
  COMPLETED = 'COMPLETED', // Calificación terminada
  FAILED = 'FAILED', // Error en extracción o IA
}

registerEnumType(SubmissionStatus, {
  name: 'SubmissionStatus',
  description: 'Status of a submission',
});
