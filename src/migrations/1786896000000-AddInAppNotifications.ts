import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInAppNotifications1786896000000 implements MigrationInterface {
  name = 'AddInAppNotifications1786896000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "in_app_notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "recipient_id" uuid NOT NULL,
        "event_key" text NOT NULL,
        "type" text NOT NULL,
        "title" text NOT NULL,
        "body" text NOT NULL,
        "url" text NOT NULL,
        "resource_type" text NOT NULL,
        "resource_id" uuid NOT NULL,
        "read_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_in_app_notifications" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_in_app_notifications_type"
          CHECK ("type" IN ('NEW_SUBMISSION', 'GRADE_PUBLISHED')),
        CONSTRAINT "CHK_in_app_notifications_resource_type"
          CHECK ("resource_type" IN ('SUBMISSION', 'EVALUATION')),
        CONSTRAINT "FK_in_app_notifications_recipient"
          FOREIGN KEY ("recipient_id") REFERENCES "users"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_in_app_notifications_recipient_event"
      ON "in_app_notifications" ("recipient_id", "event_key")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_in_app_notifications_recipient_created"
      ON "in_app_notifications" ("recipient_id", "created_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_in_app_notifications_recipient_unread"
      ON "in_app_notifications" ("recipient_id") WHERE "read_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_in_app_notifications_recipient_unread"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_in_app_notifications_recipient_created"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_in_app_notifications_recipient_event"`);
    await queryRunner.query(`DROP TABLE "in_app_notifications"`);
  }
}
