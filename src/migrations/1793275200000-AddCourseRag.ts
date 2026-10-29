import { MigrationInterface, QueryRunner } from 'typeorm';
export class AddCourseRag1793275200000 implements MigrationInterface {
  name = 'AddCourseRag1793275200000';
  async up(runner: QueryRunner): Promise<void> {
    const [vector] = await runner.query("SELECT 1 FROM pg_extension WHERE extname = 'vector'");
    if (!vector) throw new Error('Habilita pgvector con el preflight antes de migrar RAG.');
    await runner.query(`CREATE TABLE course_rag_indexes (
      version_id uuid PRIMARY KEY REFERENCES course_document_versions(id) ON DELETE CASCADE,
      content_hash varchar(64) NOT NULL, model text NOT NULL, revision text NOT NULL,
      total integer NOT NULL CHECK (total BETWEEN 1 AND 512),
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
    await runner.query(`CREATE TABLE course_rag_chunks (
      version_id uuid NOT NULL REFERENCES course_rag_indexes(version_id) ON DELETE CASCADE,
      ordinal integer NOT NULL CHECK (ordinal >= 0), page integer NOT NULL CHECK (page > 0),
      content text NOT NULL CHECK (length(content) BETWEEN 1 AND 1600),
      embedding vector(768) NOT NULL, PRIMARY KEY (version_id, ordinal)
    )`);
    await runner.query(`CREATE FUNCTION invalidate_course_rag() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.status <> 'PUBLISHED' OR NEW.content_hash IS DISTINCT FROM OLD.content_hash
          OR NEW.pages IS DISTINCT FROM OLD.pages OR NEW.published_at IS DISTINCT FROM OLD.published_at
          OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at OR NEW.extraction_state <> 'READY' THEN
          DELETE FROM course_rag_indexes WHERE version_id = NEW.id;
        END IF;
        RETURN NEW;
      END $$`);
    await runner.query(`CREATE TRIGGER course_rag_invalidation AFTER UPDATE ON course_document_versions
      FOR EACH ROW EXECUTE FUNCTION invalidate_course_rag()`);
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP TRIGGER course_rag_invalidation ON course_document_versions');
    await runner.query('DROP FUNCTION invalidate_course_rag()');
    await runner.query('DROP TABLE course_rag_chunks');
    await runner.query('DROP TABLE course_rag_indexes');
  }
}
