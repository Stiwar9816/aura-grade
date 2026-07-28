import { DataSource, DataSourceOptions } from 'typeorm';
import { envs } from './envs';

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: envs.db_host,
  port: +envs.db_port,
  username: envs.db_username,
  password: envs.db_password,
  database: envs.db_name,
  ssl: envs.db_ssl_mode === 'require' ? { rejectUnauthorized: false } : false,
  extra: {
    connectionTimeoutMillis: envs.db_connection_timeout_ms,
    keepAlive: true,
    application_name: 'aura-grade',
  },
  entities: envs.state === 'prod' ? ['dist/**/*.entity.js'] : ['src/**/*.entity.ts'],
  migrations: envs.state === 'prod' ? ['dist/migrations/*.js'] : ['src/migrations/*.ts'],
  synchronize: false, // Always false for CLI
};

export const AppDataSource = new DataSource(dataSourceOptions);
