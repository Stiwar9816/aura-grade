import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGradingFailedNotifications1787241600000 implements MigrationInterface {
  name = 'AddGradingFailedNotifications1787241600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "in_app_notifications" DROP CONSTRAINT "CHK_in_app_notifications_type"`
    );
    await queryRunner.query(`
      ALTER TABLE "in_app_notifications"
      ADD CONSTRAINT "CHK_in_app_notifications_type"
      CHECK ("type" IN ('NEW_SUBMISSION', 'GRADE_PUBLISHED', 'ASSIGNMENT_REMINDER', 'GRADING_FAILED'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "in_app_notifications" DROP CONSTRAINT "CHK_in_app_notifications_type"`
    );
    await queryRunner.query(`DELETE FROM "in_app_notifications" WHERE "type" = 'GRADING_FAILED'`);
    await queryRunner.query(`
      ALTER TABLE "in_app_notifications"
      ADD CONSTRAINT "CHK_in_app_notifications_type"
      CHECK ("type" IN ('NEW_SUBMISSION', 'GRADE_PUBLISHED', 'ASSIGNMENT_REMINDER'))
    `);
  }
}
