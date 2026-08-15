import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAssignmentReminderNotifications1786982400000 implements MigrationInterface {
  name = 'AddAssignmentReminderNotifications1786982400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "reminder_notifications_enabled" boolean NOT NULL DEFAULT true`
    );
    await queryRunner.query(
      `ALTER TABLE "notification_deliveries" DROP CONSTRAINT "CHK_notification_deliveries_type"`
    );
    await queryRunner.query(`
      ALTER TABLE "notification_deliveries"
      ADD CONSTRAINT "CHK_notification_deliveries_type"
      CHECK ("type" IN ('NEW_SUBMISSION', 'GRADE_PUBLISHED', 'ASSIGNMENT_REMINDER'))
    `);
    await queryRunner.query(
      `ALTER TABLE "in_app_notifications" DROP CONSTRAINT "CHK_in_app_notifications_type"`
    );
    await queryRunner.query(`
      ALTER TABLE "in_app_notifications"
      ADD CONSTRAINT "CHK_in_app_notifications_type"
      CHECK ("type" IN ('NEW_SUBMISSION', 'GRADE_PUBLISHED', 'ASSIGNMENT_REMINDER'))
    `);
    await queryRunner.query(
      `ALTER TABLE "in_app_notifications" DROP CONSTRAINT "CHK_in_app_notifications_resource_type"`
    );
    await queryRunner.query(`
      ALTER TABLE "in_app_notifications"
      ADD CONSTRAINT "CHK_in_app_notifications_resource_type"
      CHECK ("resource_type" IN ('SUBMISSION', 'EVALUATION', 'ASSIGNMENT'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "in_app_notifications" DROP CONSTRAINT "CHK_in_app_notifications_resource_type"`
    );
    await queryRunner.query(
      `ALTER TABLE "in_app_notifications" DROP CONSTRAINT "CHK_in_app_notifications_type"`
    );
    await queryRunner.query(
      `DELETE FROM "in_app_notifications" WHERE "type" = 'ASSIGNMENT_REMINDER'`
    );
    await queryRunner.query(`
      ALTER TABLE "in_app_notifications"
      ADD CONSTRAINT "CHK_in_app_notifications_resource_type"
      CHECK ("resource_type" IN ('SUBMISSION', 'EVALUATION'))
    `);
    await queryRunner.query(`
      ALTER TABLE "in_app_notifications"
      ADD CONSTRAINT "CHK_in_app_notifications_type"
      CHECK ("type" IN ('NEW_SUBMISSION', 'GRADE_PUBLISHED'))
    `);
    await queryRunner.query(
      `ALTER TABLE "notification_deliveries" DROP CONSTRAINT "CHK_notification_deliveries_type"`
    );
    await queryRunner.query(
      `DELETE FROM "notification_deliveries" WHERE "type" = 'ASSIGNMENT_REMINDER'`
    );
    await queryRunner.query(`
      ALTER TABLE "notification_deliveries"
      ADD CONSTRAINT "CHK_notification_deliveries_type"
      CHECK ("type" IN ('NEW_SUBMISSION', 'GRADE_PUBLISHED'))
    `);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "reminder_notifications_enabled"`);
  }
}
