import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCourseDocumentLibrary1792843200000 implements MigrationInterface {
  name = 'AddCourseDocumentLibrary1792843200000';
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE course_documents (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      course_id uuid NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
      title varchar(200) NOT NULL CHECK (length(trim(title)) > 0),
      kind text NOT NULL CHECK (kind IN ('GUIDE', 'SCHEDULE', 'MATERIAL')),
      next_version integer NOT NULL DEFAULT 1 CHECK (next_version > 0),
      last_published_version integer NOT NULL DEFAULT 0 CHECK (last_published_version >= 0),
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
    await runner.query(
      `CREATE UNIQUE INDEX uq_course_official_document ON course_documents(course_id, kind) WHERE kind IN ('GUIDE', 'SCHEDULE')`
    );
    await runner.query(
      `CREATE INDEX idx_course_documents_course ON course_documents(course_id, created_at)`
    );
    await runner.query(`CREATE TABLE course_document_versions (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      document_id uuid NOT NULL REFERENCES course_documents(id) ON DELETE RESTRICT,
      version integer NOT NULL CHECK (version > 0),
      status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PUBLISHED','ARCHIVED')),
      original_name varchar(255) NOT NULL,
      format text NOT NULL CHECK (format IN ('pdf','docx')),
      size_bytes integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 15728640),
      storage_public_id text NOT NULL,
      content_hash varchar(64) NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
      idempotency_key uuid NOT NULL,
      extraction_state text NOT NULL CHECK (extraction_state IN ('READY','NEEDS_TEXT')),
      extracted_text text NOT NULL CHECK (length(extracted_text) <= 500000),
      pages jsonb NOT NULL DEFAULT '[]'::jsonb,
      uploaded_by_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      reviewed_by_id uuid REFERENCES users(id) ON DELETE RESTRICT,
      reviewed_at timestamptz,
      published_at timestamptz,
      archived_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT uq_document_version UNIQUE(document_id, version),
      CONSTRAINT uq_document_upload_key UNIQUE(document_id, idempotency_key),
      CONSTRAINT chk_document_publication CHECK (status <> 'PUBLISHED' OR (extraction_state = 'READY' AND length(trim(extracted_text)) > 0 AND reviewed_at IS NOT NULL AND reviewed_by_id IS NOT NULL AND published_at IS NOT NULL))
    )`);
    await runner.query(
      `CREATE UNIQUE INDEX uq_document_published_version ON course_document_versions(document_id) WHERE status = 'PUBLISHED'`
    );
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP TABLE course_document_versions');
    await runner.query('DROP TABLE course_documents');
  }
}
