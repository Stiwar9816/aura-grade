export const NOTIFICATIONS_QUEUE = 'notifications';

export enum NotificationJobType {
  NEW_SUBMISSION = 'NEW_SUBMISSION',
  GRADE_PUBLISHED = 'GRADE_PUBLISHED',
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
};

export const notificationEventKey = (type: NotificationJobType, aggregateId: string): string =>
  type === NotificationJobType.NEW_SUBMISSION
    ? `new-submission-${aggregateId}`
    : `grade-published-${aggregateId}`;
