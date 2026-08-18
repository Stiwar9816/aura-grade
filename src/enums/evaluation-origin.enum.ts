import { registerEnumType } from '@nestjs/graphql';

export enum EvaluationOrigin {
  AI = 'AI',
  MANUAL = 'MANUAL',
}

registerEnumType(EvaluationOrigin, {
  name: 'EvaluationOrigin',
  description: 'Origin of an evaluation draft',
});
