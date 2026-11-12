import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Files moved from Cloudinary to private object storage (Supabase Storage). Stored identifiers
 * are now provider-neutral object keys, and submissions no longer keep a provider URL: downloads
 * always go through the authenticated endpoint that issues a short-lived signed URL.
 * Existing Cloudinary identifiers are not valid object keys, so they are cleared, not renamed.
 */
export class MoveFilesToObjectStorage1794500000000 implements MigrationInterface {
  name = 'MoveFilesToObjectStorage1794500000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query('ALTER TABLE submissions RENAME COLUMN cloudinary_public_id TO storage_key');
    await runner.query(
      "UPDATE submissions SET storage_key = NULL WHERE storage_key IS NOT NULL AND storage_key NOT LIKE 'submissions/%'"
    );
    await runner.query('ALTER TABLE submissions DROP COLUMN "fileUrl"');
    await runner.query(
      'ALTER TABLE course_document_versions RENAME COLUMN storage_public_id TO storage_key'
    );
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(
      'ALTER TABLE course_document_versions RENAME COLUMN storage_key TO storage_public_id'
    );
    await runner.query('ALTER TABLE submissions ADD COLUMN "fileUrl" text');
    await runner.query('ALTER TABLE submissions RENAME COLUMN storage_key TO cloudinary_public_id');
  }
}
