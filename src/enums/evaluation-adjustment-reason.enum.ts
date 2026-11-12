import { registerEnumType } from '@nestjs/graphql';

/** Why the teacher changed the draft. A training label: it never affects the grade. */
export enum EvaluationAdjustmentReason {
  AI_TOO_STRICT = 'AI_TOO_STRICT',
  AI_TOO_LENIENT = 'AI_TOO_LENIENT',
  AI_MISSED_ERROR = 'AI_MISSED_ERROR',
  AI_MISREAD_SUBMISSION = 'AI_MISREAD_SUBMISSION',
  RUBRIC_MISAPPLIED = 'RUBRIC_MISAPPLIED',
  FEEDBACK_UNCLEAR = 'FEEDBACK_UNCLEAR',
  OTHER = 'OTHER',
}

registerEnumType(EvaluationAdjustmentReason, {
  name: 'EvaluationAdjustmentReason',
  description: 'Reason given by the teacher for changing an evaluation draft',
});
