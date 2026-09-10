import { MigrationInterface, QueryRunner } from 'typeorm';
export class OutboxLeaseAndSecurityIndexes1789048801000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE outbox_events ADD COLUMN locked_until timestamptz, ADD COLUMN lease_token uuid'
    );
    await queryRunner.query(
      'CREATE INDEX users_password_reset_hash ON users(password_reset_token_hash) WHERE password_reset_token_hash IS NOT NULL'
    );
    await queryRunner.query(
      'CREATE INDEX submissions_assignment_student ON submissions(assignment_id, student_id)'
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX submissions_assignment_student');
    await queryRunner.query('DROP INDEX users_password_reset_hash');
    await queryRunner.query(
      'ALTER TABLE outbox_events DROP COLUMN locked_until, DROP COLUMN lease_token'
    );
  }
}
