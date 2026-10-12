import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOperationsFeedbackOnboarding1789135200000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE users
       ADD COLUMN onboarding_completed_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
       ADD COLUMN onboarding_dismissed_at timestamptz`
    );
    await queryRunner.query(
      `CREATE TABLE feedback_entries (
        id uuid NOT NULL DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL,
        institution_id uuid NOT NULL,
        category text NOT NULL,
        status text NOT NULL DEFAULT 'OPEN',
        message varchar(2000) NOT NULL,
        page varchar(300) NOT NULL,
        reference_id varchar(120),
        admin_note varchar(1000),
        resolved_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT PK_feedback_entries PRIMARY KEY (id),
        CONSTRAINT FK_feedback_entries_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT CK_feedback_entries_category CHECK (category IN ('BUG','SUGGESTION','QUESTION','OTHER')),
        CONSTRAINT CK_feedback_entries_status CHECK (status IN ('OPEN','IN_REVIEW','RESOLVED'))
      )`
    );
    await queryRunner.query(
      'CREATE INDEX IDX_feedback_institution_status_created ON feedback_entries(institution_id, status, created_at DESC)'
    );
    await queryRunner.query(
      'CREATE INDEX IDX_feedback_user_created ON feedback_entries(user_id, created_at DESC)'
    );
    await queryRunner.query(
      `CREATE INDEX submissions_failed_updated ON submissions("updatedAt" DESC)
       WHERE status = 'FAILED'`
    );
    await queryRunner.query(
      `CREATE INDEX outbox_pending_created ON outbox_events(created_at)
       WHERE dispatched_at IS NULL`
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX outbox_pending_created');
    await queryRunner.query('DROP INDEX submissions_failed_updated');
    await queryRunner.query('DROP INDEX IDX_feedback_user_created');
    await queryRunner.query('DROP INDEX IDX_feedback_institution_status_created');
    await queryRunner.query('DROP TABLE feedback_entries');
    await queryRunner.query(
      'ALTER TABLE users DROP COLUMN onboarding_dismissed_at, DROP COLUMN onboarding_completed_steps'
    );
  }
}
