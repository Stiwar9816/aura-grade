import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A course is one SGA subject of one SGA group: `code_course` is the group (PGINS2301QDOA) and the
 * new `sga_subject_code` is the subject inside it (000067). Existing courses keep NULL until their
 * teacher fills it in; only filled pairs are unique per teacher.
 */
export class AddCourseSgaSubjectCode1794700000000 implements MigrationInterface {
  name = 'AddCourseSgaSubjectCode1794700000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query('ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "sga_subject_code" text');
    await runner.query(
      `ALTER TABLE "courses" ADD CONSTRAINT "CHK_courses_sga_subject_code"
       CHECK ("sga_subject_code" IS NULL OR "sga_subject_code" ~ '^[0-9]{6}$')`
    );
    await runner.query(
      `CREATE UNIQUE INDEX "UQ_courses_teacher_group_subject"
       ON "courses" ("user_id", "code_course", "sga_subject_code")
       WHERE "sga_subject_code" IS NOT NULL`
    );
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP INDEX IF EXISTS "UQ_courses_teacher_group_subject"');
    await runner.query(
      'ALTER TABLE "courses" DROP CONSTRAINT IF EXISTS "CHK_courses_sga_subject_code"'
    );
    await runner.query('ALTER TABLE "courses" DROP COLUMN IF EXISTS "sga_subject_code"');
  }
}
