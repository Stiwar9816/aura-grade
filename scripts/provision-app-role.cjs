// Idempotent least-privilege setup for a managed PostgreSQL (Supabase).
// Run with the admin URL; the API then connects as APP_DB_ROLE, never as postgres.
//   ADMIN_DATABASE_URL=... APP_DB_PASSWORD=... node scripts/provision-app-role.cjs
// Run once before migrations (enables pgvector) and again after them (grants on new tables).
const { Client } = require('pg');

const adminUrl = process.env.ADMIN_DATABASE_URL;
const role = process.env.APP_DB_ROLE || 'aura_grade_app';
const password = process.env.APP_DB_PASSWORD;
if (!adminUrl || !password) throw new Error('ADMIN_DATABASE_URL y APP_DB_PASSWORD son requeridos.');
if (!/^[a-z_][a-z0-9_]*$/.test(role)) throw new Error('APP_DB_ROLE inválido.');
if (password.length < 32) throw new Error('APP_DB_PASSWORD debe tener al menos 32 caracteres.');

// Supabase exposes `public` through its Data API with these roles; this API does not use it.
const DATA_API_ROLES = 'anon, authenticated, service_role';

const db = new Client({
  connectionString: adminUrl.replace(/[?&]sslmode=[^&]*/, ''),
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

(async () => {
  await db.connect();
  const owner = (await db.query('SELECT current_user AS name')).rows[0].name;
  const dbName = (await db.query('SELECT current_database() AS name')).rows[0].name;
  const id = db.escapeIdentifier.bind(db);
  const pass = db.escapeLiteral(password);

  await db.query('CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions');

  const exists = await db.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [role]);
  // Supabase's postgres cannot re-alter role attributes, so they are set only on creation.
  await db.query(
    exists.rowCount
      ? `ALTER ROLE ${id(role)} WITH LOGIN PASSWORD ${pass}`
      : `CREATE ROLE ${id(role)} WITH LOGIN PASSWORD ${pass}
         NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 20`
  );
  await db.query(`ALTER ROLE ${id(role)} SET search_path = public, extensions`);
  await db.query(`GRANT CONNECT ON DATABASE ${id(dbName)} TO ${id(role)}`);
  await db.query(`GRANT USAGE ON SCHEMA public, extensions TO ${id(role)}`);
  await db.query(`REVOKE CREATE ON SCHEMA public FROM ${id(role)}`);
  await db.query(
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${id(role)}`
  );
  await db.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${id(role)}`);
  await db.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${id(role)}`);
  const defaults = `ALTER DEFAULT PRIVILEGES FOR ROLE ${id(owner)} IN SCHEMA public`;
  await db.query(`${defaults} GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${id(role)}`);
  await db.query(`${defaults} GRANT USAGE, SELECT ON SEQUENCES TO ${id(role)}`);
  await db.query(`${defaults} GRANT EXECUTE ON FUNCTIONS TO ${id(role)}`);

  for (const kind of ['TABLES', 'SEQUENCES', 'FUNCTIONS']) {
    await db.query(`REVOKE ALL ON ALL ${kind} IN SCHEMA public FROM ${DATA_API_ROLES}`);
    await db.query(`${defaults} REVOKE ALL ON ${kind} FROM ${DATA_API_ROLES}`);
  }

  const check = await db.query(
    `SELECT r.rolsuper, r.rolcreaterole, r.rolcreatedb, r.rolbypassrls,
       (SELECT count(*) FROM pg_tables WHERE schemaname = 'public') AS tables,
       (SELECT count(*) FROM information_schema.role_table_grants
         WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated', 'service_role'))
         AS data_api_grants,
       (SELECT extversion FROM pg_extension WHERE extname = 'vector') AS vector
     FROM pg_roles r WHERE r.rolname = $1`,
    [role]
  );
  console.log(JSON.stringify({ role, ...check.rows[0] }));
})()
  .catch((error) => {
    console.error(`Provisioning failed: ${error.code || error.name}: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => db.end());
