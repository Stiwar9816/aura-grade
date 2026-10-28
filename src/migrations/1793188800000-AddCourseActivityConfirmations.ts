import { MigrationInterface, QueryRunner } from 'typeorm';
export class AddCourseActivityConfirmations1793188800000 implements MigrationInterface {
  name = 'AddCourseActivityConfirmations1793188800000';
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE course_activity_confirmations (
      assignment_id uuid PRIMARY KEY REFERENCES assignments(id) ON DELETE CASCADE,
      guide_version_id uuid NOT NULL REFERENCES course_document_versions(id) ON DELETE RESTRICT,
      schedule_version_id uuid NOT NULL REFERENCES course_document_versions(id) ON DELETE RESTRICT,
      guide_section varchar(300) NOT NULL CHECK (length(trim(guide_section)) > 0),
      schedule_section varchar(300) NOT NULL CHECK (length(trim(schedule_section)) > 0),
      activity_hash varchar(64) NOT NULL CHECK (activity_hash ~ '^[a-f0-9]{64}$'),
      confirmed_by_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      confirmed_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT chk_activity_distinct_sources CHECK (guide_version_id <> schedule_version_id)
    )`);
    await runner.query(
      'CREATE INDEX idx_activity_confirmation_guide ON course_activity_confirmations(guide_version_id)'
    );
    await runner.query(
      'CREATE INDEX idx_activity_confirmation_schedule ON course_activity_confirmations(schedule_version_id)'
    );
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP TABLE course_activity_confirmations');
  }
}
