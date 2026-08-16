import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubmissionGradingDiagnostics1787155200000 implements MigrationInterface {
  name = 'AddSubmissionGradingDiagnostics1787155200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "submissions" ADD "grading_attempt_count" integer NOT NULL DEFAULT 0`
    );
    await queryRunner.query(`ALTER TABLE "submissions" ADD "grading_failure_reason" text`);
    await queryRunner.query(
      `ALTER TABLE "submissions" ADD "grading_last_attempt_at" TIMESTAMP WITH TIME ZONE`
    );
    await queryRunner.query(
      `ALTER TABLE "submissions" ADD CONSTRAINT "CHK_submissions_grading_attempt_count" CHECK ("grading_attempt_count" >= 0)`
    );
    await queryRunner.query(`
      UPDATE "submissions"
      SET
        "grading_attempt_count" = 3,
        "grading_failure_reason" = 'La evaluación falló antes de habilitarse el diagnóstico detallado.',
        "grading_last_attempt_at" = "updatedAt"
      WHERE "status" = 'FAILED'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "submissions" DROP CONSTRAINT "CHK_submissions_grading_attempt_count"`
    );
    await queryRunner.query(`ALTER TABLE "submissions" DROP COLUMN "grading_last_attempt_at"`);
    await queryRunner.query(`ALTER TABLE "submissions" DROP COLUMN "grading_failure_reason"`);
    await queryRunner.query(`ALTER TABLE "submissions" DROP COLUMN "grading_attempt_count"`);
  }
}
