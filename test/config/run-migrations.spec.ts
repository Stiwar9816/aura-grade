import { DataSource } from 'typeorm';
import { isTransientDatabaseError, runMigrationsWithRetry } from '../../src/scripts/run-migrations';

function dataSourceMock(overrides: Partial<DataSource> = {}): DataSource {
  return {
    initialize: jest.fn().mockResolvedValue(undefined),
    runMigrations: jest.fn().mockResolvedValue([]),
    destroy: jest.fn().mockResolvedValue(undefined),
    isInitialized: false,
    ...overrides,
  } as unknown as DataSource;
}

describe('migration runner', () => {
  it.each([
    [{ code: 'ECONNRESET' }],
    [new Error('Connection terminated unexpectedly')],
    [{ cause: { code: '57P03' } }],
  ])('recognizes transient connection errors', (error) => {
    expect(isTransientDatabaseError(error)).toBe(true);
  });

  it('does not classify SQL migration failures as transient', () => {
    expect(isTransientDatabaseError({ code: '23505', message: 'duplicate key' })).toBe(false);
  });

  it('retries with a fresh datasource and exponential backoff', async () => {
    const first = dataSourceMock({
      initialize: jest.fn().mockRejectedValue(new Error('Connection terminated unexpectedly')),
    });
    const second = dataSourceMock();
    const createDataSource = jest.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
    const wait = jest.fn().mockResolvedValue(undefined);

    await runMigrationsWithRetry(createDataSource, { maxAttempts: 3, retryDelayMs: 2000 }, wait);

    expect(createDataSource).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledWith(2000);
    expect(second.runMigrations).toHaveBeenCalledWith({ transaction: 'all' });
    expect(second.destroy).toHaveBeenCalled();
  });

  it('fails immediately for a non-transient migration error', async () => {
    const migrationError = Object.assign(new Error('duplicate key'), { code: '23505' });
    const source = dataSourceMock({
      runMigrations: jest.fn().mockRejectedValue(migrationError),
      isInitialized: true,
    });
    const createDataSource = jest.fn().mockReturnValue(source);
    const wait = jest.fn();

    await expect(
      runMigrationsWithRetry(createDataSource, { maxAttempts: 10, retryDelayMs: 2000 }, wait)
    ).rejects.toBe(migrationError);

    expect(createDataSource).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });
});
