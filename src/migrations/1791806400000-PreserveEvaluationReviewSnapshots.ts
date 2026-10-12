import { MigrationInterface, QueryRunner } from 'typeorm';

export class PreserveEvaluationReviewSnapshots1791806400000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE evaluations
      ADD COLUMN original_draft_snapshot jsonb,
      ADD COLUMN teacher_review_snapshot jsonb`);
    // Existing published grades remain NULL: their original AI result cannot be reconstructed.
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE evaluations
      DROP COLUMN teacher_review_snapshot,
      DROP COLUMN original_draft_snapshot`);
  }
}
