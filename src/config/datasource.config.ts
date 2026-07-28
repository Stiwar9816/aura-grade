import { DataSource, DataSourceOptions } from 'typeorm';
import { databaseEnvs } from './database-envs';

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: databaseEnvs.db_host,
  port: +databaseEnvs.db_port,
  username: databaseEnvs.db_username,
  password: databaseEnvs.db_password,
  database: databaseEnvs.db_name,
  ssl: databaseEnvs.db_ssl_mode === 'require' ? { rejectUnauthorized: false } : false,
  extra: {
    connectionTimeoutMillis: databaseEnvs.db_connection_timeout_ms,
    keepAlive: true,
    application_name: 'aura-grade',
  },
  entities: databaseEnvs.state === 'prod' ? ['dist/**/*.entity.js'] : ['src/**/*.entity.ts'],
  migrations: databaseEnvs.state === 'prod' ? ['dist/migrations/*.js'] : ['src/migrations/*.ts'],
  synchronize: false, // Always false for CLI
};

export const AppDataSource = new DataSource(dataSourceOptions);
