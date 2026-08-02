import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserNotificationPreferences1785686800000 implements MigrationInterface {
  name = 'AddUserNotificationPreferences1785686800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "email_notifications_enabled" boolean NOT NULL DEFAULT true`
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "browser_notifications_enabled" boolean NOT NULL DEFAULT false`
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "submission_notifications_enabled" boolean NOT NULL DEFAULT true`
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "grade_notifications_enabled" boolean NOT NULL DEFAULT true`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "grade_notifications_enabled"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "submission_notifications_enabled"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "browser_notifications_enabled"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "email_notifications_enabled"`);
  }
}
