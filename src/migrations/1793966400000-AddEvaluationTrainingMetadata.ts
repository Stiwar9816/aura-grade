import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEvaluationTrainingMetadata1793966400000 implements MigrationInterface {
  name = 'AddEvaluationTrainingMetadata1793966400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE evaluations
      ADD COLUMN prompt_version text,
      ADD COLUMN reevaluation_revision_snapshot jsonb`);
    // Earlier drafts keep NULL: the prompt version they used was not recorded.
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE evaluations
      DROP COLUMN reevaluation_revision_snapshot,
      DROP COLUMN prompt_version`);
  }
}
