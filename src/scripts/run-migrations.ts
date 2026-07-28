import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../config/datasource.config';
import { envs } from '../config/envs';

const logger = new Logger('MigrationRunner');

const TRANSIENT_CODES = new Set([
  '57P01',
  '57P02',
  '57P03',
  '08000',
  '08001',
  '08003',
  '08004',
  '08006',
  '08007',
  '08P01',
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ETIMEDOUT',
]);

const TRANSIENT_MESSAGES = [
  'connection terminated unexpectedly',
  'connection terminated',
  'connection timeout',
  'server closed the connection unexpectedly',
  'the database system is starting up',
  'the database system is shutting down',
  'timeout expired',
];

interface ErrorLike {
  code?: string;
  message?: string;
  cause?: unknown;
}

const sanitizeLogValue = (value: string, maxLength: number): string =>
  value.replace(/[\r\n]/g, ' ').slice(0, maxLength);

export interface MigrationRetryOptions {
  maxAttempts: number;
  retryDelayMs: number;
}

export function isTransientDatabaseError(error: unknown): boolean {
  let current: unknown = error;

  for (let depth = 0; current && depth < 5; depth += 1) {
    const candidate = current as ErrorLike;
    if (candidate.code && TRANSIENT_CODES.has(candidate.code)) return true;

    const message = candidate.message?.toLowerCase() ?? '';
    if (TRANSIENT_MESSAGES.some((fragment) => message.includes(fragment))) return true;
    current = candidate.cause;
  }

  return false;
}

export function describeDatabaseError(error: unknown): string {
  let current: unknown = error;

  for (let depth = 0; current && depth < 5; depth += 1) {
    const candidate = current as ErrorLike;
    const code = candidate.code && sanitizeLogValue(candidate.code, 64);
    const message = candidate.message && sanitizeLogValue(candidate.message, 300);

    if (code || message) {
      return [code && `code=${code}`, message && `message="${message}"`].filter(Boolean).join(' ');
    }

    current = candidate.cause;
  }

  return 'no error details available';
}

export function describeDatabaseTarget(
  host: string,
  port: number,
  database: string,
  sslMode: string
): string {
  return `host=${sanitizeLogValue(host, 255)} port=${port} database=${sanitizeLogValue(database, 128)} ssl=${sanitizeLogValue(sslMode, 16)}`;
}

export async function runMigrationsWithRetry(
  createDataSource: () => DataSource,
  options: MigrationRetryOptions,
  wait: (milliseconds: number) => Promise<void> = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds))
): Promise<void> {
  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    const dataSource = createDataSource();

    try {
      await dataSource.initialize();
      const applied = await dataSource.runMigrations({ transaction: 'all' });
      logger.log(
        applied.length
          ? `Applied ${applied.length} migration(s): ${applied.map(({ name }) => name).join(', ')}`
          : 'Database schema is up to date.'
      );
      await dataSource.destroy();
      return;
    } catch (error) {
      if (dataSource.isInitialized) {
        try {
          await dataSource.destroy();
        } catch {
          // The connection may already be gone; the next attempt uses a fresh pool.
        }
      }

      const retryable = isTransientDatabaseError(error);
      if (!retryable || attempt === options.maxAttempts) throw error;

      const delay = Math.min(options.retryDelayMs * 2 ** (attempt - 1), 30000);
      logger.warn(
        `Transient database error during migration attempt ${attempt}/${options.maxAttempts}: ${describeDatabaseError(error)}. Retrying in ${delay} ms.`
      );
      await wait(delay);
    }
  }
}

async function main(): Promise<void> {
  logger.log(
    `Starting database migrations: ${describeDatabaseTarget(
      envs.db_host,
      envs.db_port,
      envs.db_name,
      envs.db_ssl_mode
    )}`
  );
  await runMigrationsWithRetry(() => new DataSource(dataSourceOptions), {
    maxAttempts: envs.db_migration_max_attempts,
    retryDelayMs: envs.db_migration_retry_delay_ms,
  });
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    logger.error(
      `Migration run failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      error instanceof Error ? error.stack : undefined
    );
    process.exitCode = 1;
  });
}
