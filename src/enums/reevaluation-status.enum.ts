import { registerEnumType } from '@nestjs/graphql';

export enum ReEvaluationStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

registerEnumType(ReEvaluationStatus, {
  name: 'ReEvaluationStatus',
  description: 'Status of a re-evaluation request',
});
