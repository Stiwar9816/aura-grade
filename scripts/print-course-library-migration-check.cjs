// Emit an isolated, rollback-only PostgreSQL check. Build first; pipe into local psql.
const { AddCourseDocumentLibrary1792843200000: Migration } = require('../dist/migrations/1792843200000-AddCourseDocumentLibrary');
(async () => {
  const statements = [];
  const runner = { query: async sql => { statements.push(sql); } };
  const migration = new Migration();
  statements.push('BEGIN', `CREATE SCHEMA aura_library_check_${process.pid}`, `SET LOCAL search_path TO aura_library_check_${process.pid}, public`);
  statements.push('CREATE TABLE courses (id uuid PRIMARY KEY)', 'CREATE TABLE users (id uuid PRIMARY KEY)');
  await migration.up(runner);
  statements.push(`INSERT INTO courses VALUES ('00000000-0000-4000-8000-000000000001')`, `INSERT INTO users VALUES ('00000000-0000-4000-8000-000000000002')`);
  statements.push(`INSERT INTO course_documents (id, course_id, title, kind) VALUES ('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001','Guía','GUIDE')`);
  statements.push(`DO $$ BEGIN
    BEGIN
      INSERT INTO course_documents (course_id,title,kind) VALUES ('00000000-0000-4000-8000-000000000001','Duplicada','GUIDE');
      RAISE EXCEPTION 'Duplicate official guide accepted';
    EXCEPTION WHEN unique_violation THEN NULL; END;
  END $$`);
  const insert = (version, status, reviewed) => `INSERT INTO course_document_versions
    (document_id,version,status,original_name,format,size_bytes,storage_public_id,content_hash,idempotency_key,extraction_state,extracted_text,uploaded_by_id,reviewed_by_id,reviewed_at,published_at)
    VALUES ('00000000-0000-4000-8000-000000000003',${version},'${status}','guide.pdf','pdf',100,'private/file.pdf',repeat('a',64),uuid_generate_v4(),'READY','Texto oficial','00000000-0000-4000-8000-000000000002',${reviewed ? "'00000000-0000-4000-8000-000000000002',now(),now()" : 'NULL,NULL,NULL'})`;
  statements.push(`DO $$ BEGIN BEGIN ${insert(1, 'PUBLISHED', false)}; RAISE EXCEPTION 'Unreviewed publication accepted'; EXCEPTION WHEN check_violation THEN NULL; END; END $$`);
  statements.push(insert(1, 'PUBLISHED', true));
  statements.push(`DO $$ BEGIN BEGIN ${insert(2, 'PUBLISHED', true)}; RAISE EXCEPTION 'Two published versions accepted'; EXCEPTION WHEN unique_violation THEN NULL; END; END $$`);
  statements.push(`UPDATE course_document_versions SET status='ARCHIVED', archived_at=now()`);
  statements.push(insert(2, 'PUBLISHED', true));
  await migration.down(runner);
  await migration.up(runner);
  statements.push('ROLLBACK', "SELECT 'Course library migration up/down/up and publication constraints passed' AS result");
  process.stdout.write(statements.map(s => `${s};`).join('\n') + '\n');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
