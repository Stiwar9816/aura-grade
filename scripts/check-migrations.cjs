// For isolated CI databases only; never point this command at production.
const assert = require('node:assert/strict');
const { AppDataSource } = require('../dist/config/datasource.config');
(async () => {
  if (process.env.DB_NAME !== 'aura_grade_ci')
    throw new Error('Use only the isolated aura_grade_ci database.');
  await AppDataSource.initialize();
  try {
    await AppDataSource.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await AppDataSource.runMigrations();
    assert.equal(await AppDataSource.showMigrations(), false);
    assert.deepEqual(await AppDataSource.runMigrations(), []);
    const columns = await AppDataSource.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name='evaluations' AND column_name IN ('original_draft_snapshot','teacher_review_snapshot')"
    );
    assert.equal(columns.length, 2);
    // Exercise only the new additive migration's down/up on this disposable schema.
    const {
      PreserveEvaluationReviewSnapshots1791806400000: Migration,
    } = require('../dist/migrations/1791806400000-PreserveEvaluationReviewSnapshots');
    const runner = AppDataSource.createQueryRunner();
    try {
      await runner.startTransaction();
      await new Migration().down(runner);
      await new Migration().up(runner);
      await runner.rollbackTransaction();
    } finally {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      await runner.release();
    }
    console.log('All migrations apply; rerun is idempotent; review snapshot down/up succeeds.');
  } finally {
    await AppDataSource.destroy();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
