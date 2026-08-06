import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationDeliveries1786118400000 implements MigrationInterface {
  name = 'AddNotificationDeliveries1786118400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "notification_deliveries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "event_key" text NOT NULL,
        "type" text NOT NULL,
        "channel" text NOT NULL,
        "status" text NOT NULL DEFAULT 'PENDING',
        "attempts" integer NOT NULL DEFAULT 0,
        "last_error" text,
        "processing_started_at" TIMESTAMP WITH TIME ZONE,
        "sent_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notification_deliveries" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_notification_deliveries_type"
          CHECK ("type" IN ('NEW_SUBMISSION', 'GRADE_PUBLISHED')),
        CONSTRAINT "CHK_notification_deliveries_channel"
          CHECK ("channel" IN ('EMAIL', 'PUSH')),
        CONSTRAINT "CHK_notification_deliveries_status"
          CHECK ("status" IN ('PENDING', 'PROCESSING', 'SENT', 'SKIPPED', 'FAILED')),
        CONSTRAINT "CHK_notification_deliveries_attempts" CHECK ("attempts" >= 0)
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_notification_deliveries_event_channel"
      ON "notification_deliveries" ("event_key", "channel")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_notification_deliveries_status_updated"
      ON "notification_deliveries" ("status", "updated_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_notification_deliveries_status_updated"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_notification_deliveries_event_channel"`);
    await queryRunner.query(`DROP TABLE "notification_deliveries"`);
  }
}
