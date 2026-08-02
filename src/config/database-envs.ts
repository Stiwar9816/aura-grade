import 'dotenv/config';
import * as joi from 'joi';

interface DatabaseEnvVars {
  STATE: string;
  DB_PORT: number;
  DB_PASSWORD: string;
  DB_NAME: string;
  DB_HOST: string;
  DB_USERNAME: string;
  DB_SSL_MODE: 'disable' | 'require';
  DB_CONNECTION_TIMEOUT_MS: number;
}

const databaseEnvsSchema = joi
  .object({
    STATE: joi.string().required(),
    DB_PORT: joi.number().required(),
    DB_PASSWORD: joi.string().required(),
    DB_NAME: joi.string().required(),
    DB_HOST: joi.string().required(),
    DB_USERNAME: joi.string().required(),
    DB_SSL_MODE: joi
      .string()
      .valid('disable', 'require')
      .when('STATE', {
        is: 'prod',
        then: joi.string().default('require'),
        otherwise: joi.string().default('disable'),
      }),
    DB_CONNECTION_TIMEOUT_MS: joi.number().integer().positive().default(10000),
  })
  .unknown(true);

const { error, value } = databaseEnvsSchema.validate({ ...process.env });

if (error)
  throw new Error(`Error de validación de configuración de base de datos: ${error.message}`);
const databaseEnvVars: DatabaseEnvVars = value;

export const databaseEnvs = {
  state: databaseEnvVars.STATE,
  db_port: databaseEnvVars.DB_PORT,
  db_host: databaseEnvVars.DB_HOST,
  db_name: databaseEnvVars.DB_NAME,
  db_username: databaseEnvVars.DB_USERNAME,
  db_password: databaseEnvVars.DB_PASSWORD,
  db_ssl_mode: databaseEnvVars.DB_SSL_MODE,
  db_connection_timeout_ms: databaseEnvVars.DB_CONNECTION_TIMEOUT_MS,
};
