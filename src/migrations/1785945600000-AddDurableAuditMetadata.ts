import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDurableAuditMetadata1785945600000 implements MigrationInterface {
  name = 'AddDurableAuditMetadata1785945600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "audit_logs" ADD "event_key" text`);
    await queryRunner.query(
      `UPDATE "audit_logs" SET "event_key" = 'legacy:' || "id"::text WHERE "event_key" IS NULL`
    );
    await queryRunner.query(`ALTER TABLE "audit_logs" ALTER COLUMN "event_key" SET NOT NULL`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_audit_logs_event_key" ON "audit_logs" ("event_key")`
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ADD "outcome" text NOT NULL DEFAULT 'SUCCESS'`
    );
    await queryRunner.query(`ALTER TABLE "audit_logs" ADD "error_code" text`);
    await queryRunner.query(`ALTER TABLE "audit_logs" ADD "duration_ms" integer`);
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ADD "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`
    );
    await queryRunner.query(
      `UPDATE "audit_logs" SET "occurred_at" = "created_at" WHERE "occurred_at" IS DISTINCT FROM "created_at"`
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ADD CONSTRAINT "CHK_audit_logs_outcome" CHECK ("outcome" IN ('SUCCESS', 'DENIED', 'FAILED'))`
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ADD CONSTRAINT "CHK_audit_logs_duration" CHECK ("duration_ms" IS NULL OR "duration_ms" >= 0)`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP CONSTRAINT "CHK_audit_logs_duration"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP CONSTRAINT "CHK_audit_logs_outcome"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN "occurred_at"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN "duration_ms"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN "error_code"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN "outcome"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_logs_event_key"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN "event_key"`);
  }
}
