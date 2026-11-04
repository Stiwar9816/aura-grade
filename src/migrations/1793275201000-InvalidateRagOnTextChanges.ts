import { MigrationInterface, QueryRunner } from 'typeorm';
export class InvalidateRagOnTextChanges1793275201000 implements MigrationInterface {
  name = 'InvalidateRagOnTextChanges1793275201000';
  async up(runner: QueryRunner): Promise<void> {
    await this.replace(runner, true);
  }
  async down(runner: QueryRunner): Promise<void> {
    await this.replace(runner, false);
  }
  private async replace(runner: QueryRunner, includeText: boolean) {
    await runner.query(`CREATE OR REPLACE FUNCTION invalidate_course_rag() RETURNS trigger LANGUAGE plpgsql AS $$
   BEGIN
    IF NEW.status <> 'PUBLISHED' OR NEW.content_hash IS DISTINCT FROM OLD.content_hash
      OR NEW.pages IS DISTINCT FROM OLD.pages OR NEW.published_at IS DISTINCT FROM OLD.published_at
      OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at OR NEW.extraction_state <> 'READY'
      ${includeText ? 'OR NEW.extracted_text IS DISTINCT FROM OLD.extracted_text' : ''} THEN
      DELETE FROM course_rag_indexes WHERE version_id=NEW.id;
    END IF;
    RETURN NEW;
   END $$`);
  }
}
