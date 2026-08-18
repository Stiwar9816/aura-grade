export const NOTIFICATIONS_QUEUE = 'notifications';

export enum NotificationJobType {
  NEW_SUBMISSION = 'NEW_SUBMISSION',
  GRADE_PUBLISHED = 'GRADE_PUBLISHED',
  GRADING_FAILED = 'GRADING_FAILED',
  ASSIGNMENT_REMINDER = 'ASSIGNMENT_REMINDER',
  DEADLINE_REMINDER_SCAN = 'DEADLINE_REMINDER_SCAN',
}

export enum AssignmentReminderKind {
  AUTO_48H = 'AUTO_48H',
  AUTO_24H = 'AUTO_24H',
  MANUAL = 'MANUAL',
}

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  PUSH = 'PUSH',
}

export enum NotificationDeliveryStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SENT = 'SENT',
  SKIPPED = 'SKIPPED',
  FAILED = 'FAILED',
}

export type NotificationJobData = {
  type: NotificationJobType;
  aggregateId: string;
  eventKey: string;
  recipientId?: string;
  reminderKind?: AssignmentReminderKind;
  dueDateEpoch?: number;
};

export const notificationEventKey = (type: NotificationJobType, aggregateId: string): string =>
  type === NotificationJobType.NEW_SUBMISSION
    ? `new-submission-${aggregateId}`
    : `grade-published-${aggregateId}`;

export const gradingFailedEventKey = (gradingJobId: string): string =>
  `grading-failed-${gradingJobId}`;

export const assignmentReminderEventKey = (
  assignmentId: string,
  recipientId: string,
  dueDate: Date,
  kind: AssignmentReminderKind,
  manualBucket?: number
): string => {
  const suffix =
    kind === AssignmentReminderKind.MANUAL ? `manual-${manualBucket}` : kind.toLowerCase();
  return `assignment-reminder-${assignmentId}-${recipientId}-${dueDate.getTime()}-${suffix}`;
};
