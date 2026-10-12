import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFeedbackInstitutionIntegrity1789135201000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE feedback_entries
       ADD CONSTRAINT FK_feedback_entries_institution
       FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE RESTRICT`
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE feedback_entries DROP CONSTRAINT FK_feedback_entries_institution'
    );
  }
}
