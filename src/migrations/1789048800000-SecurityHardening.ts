import { MigrationInterface, QueryRunner } from 'typeorm';

export class SecurityHardening1789048800000 implements MigrationInterface {
  name = 'SecurityHardening1789048800000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users
      ADD COLUMN password_reset_token_hash varchar(64),
      ADD COLUMN password_reset_expires_at timestamptz,
      ADD COLUMN password_reset_requested_at timestamptz,
      ADD COLUMN password_reset_auth_version integer,
      ADD COLUMN two_factor_recovery_hashes jsonb`);
    await queryRunner.query(`ALTER TABLE submissions
      ADD COLUMN cloudinary_public_id text,
      ADD COLUMN idempotency_key uuid,
      ADD COLUMN content_hash varchar(64)`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX submissions_student_idempotency ON submissions(student_id, idempotency_key) WHERE idempotency_key IS NOT NULL`
    );
    await queryRunner.query(`CREATE TABLE outbox_events (
      id varchar(160) PRIMARY KEY, kind varchar(32) NOT NULL, aggregate_id uuid NOT NULL,
      dispatched_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`CREATE INDEX outbox_pending ON outbox_events(dispatched_at)`);
    // Recover existing unfinished submissions without deleting any academic records.
    await queryRunner.query(`INSERT INTO outbox_events(id, kind, aggregate_id)
      SELECT 'grading-' || s.id, 'grading', s.id FROM submissions s
      WHERE s.status IN ('PENDING', 'IN_PROGRESS')
      AND NOT EXISTS (SELECT 1 FROM evaluations e WHERE e.submission_id = s.id)
      ON CONFLICT DO NOTHING`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE outbox_events');
    await queryRunner.query('DROP INDEX submissions_student_idempotency');
    await queryRunner.query(
      'ALTER TABLE submissions DROP COLUMN cloudinary_public_id, DROP COLUMN idempotency_key, DROP COLUMN content_hash'
    );
    await queryRunner.query(`ALTER TABLE users DROP COLUMN password_reset_token_hash,
      DROP COLUMN password_reset_expires_at, DROP COLUMN password_reset_requested_at,
      DROP COLUMN password_reset_auth_version, DROP COLUMN two_factor_recovery_hashes`);
  }
}
