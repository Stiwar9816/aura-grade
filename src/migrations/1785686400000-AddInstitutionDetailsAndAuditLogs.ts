import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInstitutionDetailsAndAuditLogs1785686400000 implements MigrationInterface {
  name = 'AddInstitutionDetailsAndAuditLogs1785686400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "institutions" ADD "legal_name" text`);
    await queryRunner.query(`ALTER TABLE "institutions" ADD "tax_id" text`);
    await queryRunner.query(`ALTER TABLE "institutions" ADD "contact_email" text`);
    await queryRunner.query(`ALTER TABLE "institutions" ADD "phone" text`);
    await queryRunner.query(`ALTER TABLE "institutions" ADD "address" text`);
    await queryRunner.query(`ALTER TABLE "institutions" ADD "city" text`);
    await queryRunner.query(`ALTER TABLE "institutions" ADD "country" text`);
    await queryRunner.query(`ALTER TABLE "institutions" ADD "website" text`);
    await queryRunner.query(`ALTER TABLE "institutions" ADD "description" text`);
    await queryRunner.query(`ALTER TABLE "institutions" ADD "logo_url" text`);
    await queryRunner.query(
      `ALTER TABLE "institutions" ADD CONSTRAINT "UQ_institutions_tax_id" UNIQUE ("tax_id")`
    );

    await queryRunner.query(
      `CREATE TABLE "audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "actor_user_id" uuid,
        "actor_name" text NOT NULL,
        "actor_email" text,
        "institution_id" uuid NOT NULL,
        "ip_address" inet,
        "action" text NOT NULL,
        "resource" text NOT NULL,
        "resource_id" text,
        "changes" jsonb,
        "request_id" text,
        "path" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id")
      )`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_institution_created"
       ON "audit_logs" ("institution_id", "created_at" DESC)`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_logs_institution_created"`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(`ALTER TABLE "institutions" DROP CONSTRAINT "UQ_institutions_tax_id"`);
    await queryRunner.query(`ALTER TABLE "institutions" DROP COLUMN "logo_url"`);
    await queryRunner.query(`ALTER TABLE "institutions" DROP COLUMN "description"`);
    await queryRunner.query(`ALTER TABLE "institutions" DROP COLUMN "website"`);
    await queryRunner.query(`ALTER TABLE "institutions" DROP COLUMN "country"`);
    await queryRunner.query(`ALTER TABLE "institutions" DROP COLUMN "city"`);
    await queryRunner.query(`ALTER TABLE "institutions" DROP COLUMN "address"`);
    await queryRunner.query(`ALTER TABLE "institutions" DROP COLUMN "phone"`);
    await queryRunner.query(`ALTER TABLE "institutions" DROP COLUMN "contact_email"`);
    await queryRunner.query(`ALTER TABLE "institutions" DROP COLUMN "tax_id"`);
    await queryRunner.query(`ALTER TABLE "institutions" DROP COLUMN "legal_name"`);
  }
}
