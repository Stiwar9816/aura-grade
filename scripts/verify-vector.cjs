// Read-only by default. --enable is explicitly restricted to local development.
require('dotenv').config({ quiet: true });
const assert = require('node:assert/strict');
const { Client } = require('pg');
const { vectorSslOptions } = require('./vector-config.cjs');
const enable = process.argv.includes('--enable');
if (
  enable &&
  (process.env.STATE !== 'dev' || !['localhost', '127.0.0.1'].includes(process.env.DB_HOST))
) {
  throw new Error('--enable solo admite PostgreSQL local con STATE=dev.');
}
const db = new Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionTimeoutMillis: 10000,
  ssl: vectorSslOptions(process.env),
});
(async () => {
  await db.connect();
  const { rows } = await db.query(
    "SELECT default_version, installed_version FROM pg_available_extensions WHERE name='vector'"
  );
  assert.equal(
    rows.length,
    1,
    'pgvector no está instalado en el servidor. Preparar la imagen/proveedor primero.'
  );
  if (enable) await db.query('CREATE EXTENSION IF NOT EXISTS vector');
  const installed = await db.query("SELECT extversion FROM pg_extension WHERE extname='vector'");
  assert.equal(
    installed.rows.length,
    1,
    'pgvector disponible pero aún no habilitado en esta base.'
  );
  const result = await db.query("SELECT '[1,0,0]'::vector <-> '[0,0,0]'::vector AS distance");
  assert.equal(result.rows[0].distance, 1);
  console.log(
    JSON.stringify({
      vector: installed.rows[0].extversion,
      distanceCheck: 'passed',
      enabledByThisRun: enable,
    })
  );
})()
  .catch((error) => {
    console.error(
      error instanceof assert.AssertionError
        ? error.message
        : `Vector check failed: ${error.code || error.name}`
    );
    process.exitCode = 1;
  })
  .finally(() => db.end());
