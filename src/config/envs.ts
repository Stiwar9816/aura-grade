import 'dotenv/config';
import * as joi from 'joi';
import { EnvVars } from 'src/interfaces';

const envsSchema = joi
  .object({
    PORT: joi.number().required(),
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
    JWT_SECRET: joi.string().required(),
    MAIL_FROM: joi.string().required(),
    RESEND_API_KEY: joi.string().required(),
    RESEND_CONFIRMATION_TEMPLATE_ID: joi.string().required(),
    RESEND_UPDATE_PASSWORD_TEMPLATE_ID: joi.string().required(),
    RESEND_RESET_PASSWORD_TEMPLATE_ID: joi.string().required(),
    RESEND_NEW_SUBMISSION_TEMPLATE_ID: joi.string().required(),
    RESEND_GRADE_PUBLISHED_TEMPLATE_ID: joi.string().required(),
    APP_NAME: joi.string().required(),
    FRONTEND_URL: joi.string().required(),
    CLOUDINARY_API_KEY: joi.string().required(),
    CLOUDINARY_API_SECRET: joi.string().required(),
    CLOUDINARY_NAME: joi.string().required(),
    AI_PROVIDER: joi.string().valid('openai', 'gemini').required(),
    OPENAI_API_KEY: joi.string().when('AI_PROVIDER', {
      is: 'openai',
      then: joi.required(),
      otherwise: joi.optional(),
    }),
    GEMINI_API_KEY: joi.string().when('AI_PROVIDER', {
      is: 'gemini',
      then: joi.required(),
      otherwise: joi.optional(),
    }),
    REDIS_URL: joi
      .string()
      .uri({ scheme: ['redis', 'rediss'] })
      .optional(),
    REDIS_HOST: joi.when('REDIS_URL', {
      is: joi.exist(),
      then: joi.string().optional(),
      otherwise: joi.string().required(),
    }),
    REDIS_PORT: joi.when('REDIS_URL', {
      is: joi.exist(),
      then: joi.number().optional(),
      otherwise: joi.number().required(),
    }),
    BASIC_AUTH_PASSWORD: joi.string().required(),
    BFF_SHARED_SECRET: joi.string().empty('').min(32).when('STATE', {
      is: 'prod',
      then: joi.required(),
      otherwise: joi.optional(),
    }),
    METRICS_TOKEN: joi.string().empty('').min(32).when('STATE', {
      is: 'prod',
      then: joi.required(),
      otherwise: joi.optional(),
    }),
    TRUST_PROXY_HOPS: joi.number().integer().min(0).default(0),
    AUTH_ACCEPT_LEGACY_JWT: joi.boolean().default(true),
    SESSION_IDLE_SECONDS: joi.number().integer().positive().optional(),
    SESSION_ABSOLUTE_SECONDS: joi.number().integer().positive().optional(),
    SESSION_REMEMBER_IDLE_SECONDS: joi.number().integer().positive().optional(),
    SESSION_REMEMBER_ABSOLUTE_SECONDS: joi.number().integer().positive().optional(),
    SESSION_ADMIN_IDLE_SECONDS: joi.number().integer().positive().optional(),
    SESSION_ADMIN_ABSOLUTE_SECONDS: joi.number().integer().positive().optional(),
    SESSION_REFRESH_INTERVAL_SECONDS: joi.number().integer().positive().optional(),
    SESSION_MAX_PER_USER: joi.number().integer().positive().optional(),
  })
  .unknown(true);

const { error, value } = envsSchema.validate({ ...process.env });

if (error) throw new Error(`Error de validación de configuración: ${error.message}`);
const envVars: EnvVars = value;

export const envs = {
  port: envVars.PORT,
  state: envVars.STATE,
  db_port: envVars.DB_PORT,
  db_host: envVars.DB_HOST,
  db_name: envVars.DB_NAME,
  db_username: envVars.DB_USERNAME,
  db_password: envVars.DB_PASSWORD,
  db_ssl_mode: envVars.DB_SSL_MODE,
  db_connection_timeout_ms: envVars.DB_CONNECTION_TIMEOUT_MS,
  jwt_secret: envVars.JWT_SECRET,
  mail_from: envVars.MAIL_FROM,
  resend_api_key: envVars.RESEND_API_KEY,
  resend_confirmation_template_id: envVars.RESEND_CONFIRMATION_TEMPLATE_ID,
  resend_update_password_template_id: envVars.RESEND_UPDATE_PASSWORD_TEMPLATE_ID,
  resend_reset_password_template_id: envVars.RESEND_RESET_PASSWORD_TEMPLATE_ID,
  resend_new_submission_template_id: envVars.RESEND_NEW_SUBMISSION_TEMPLATE_ID,
  resend_grade_published_template_id: envVars.RESEND_GRADE_PUBLISHED_TEMPLATE_ID,
  app_name: envVars.APP_NAME,
  frontend_url: envVars.FRONTEND_URL,
  cloudinary_api_key: envVars.CLOUDINARY_API_KEY,
  cloudinary_api_secret: envVars.CLOUDINARY_API_SECRET,
  CLOUDINARY_NAME: envVars.CLOUDINARY_NAME,
  ai_provider: envVars.AI_PROVIDER,
  gemini_api_key: envVars.GEMINI_API_KEY,
  openai_api_key: envVars.OPENAI_API_KEY,
  redis_url: envVars.REDIS_URL,
  redis_host: envVars.REDIS_HOST,
  redis_port: envVars.REDIS_PORT,
  basic_auth_password: envVars.BASIC_AUTH_PASSWORD,
  bff_shared_secret: envVars.BFF_SHARED_SECRET,
  metrics_token: envVars.METRICS_TOKEN,
  trust_proxy_hops: envVars.TRUST_PROXY_HOPS,
  auth_accept_legacy_jwt: envVars.AUTH_ACCEPT_LEGACY_JWT,
  session_idle_seconds: envVars.SESSION_IDLE_SECONDS,
  session_absolute_seconds: envVars.SESSION_ABSOLUTE_SECONDS,
  session_remember_idle_seconds: envVars.SESSION_REMEMBER_IDLE_SECONDS,
  session_remember_absolute_seconds: envVars.SESSION_REMEMBER_ABSOLUTE_SECONDS,
  session_admin_idle_seconds: envVars.SESSION_ADMIN_IDLE_SECONDS,
  session_admin_absolute_seconds: envVars.SESSION_ADMIN_ABSOLUTE_SECONDS,
  session_refresh_interval_seconds: envVars.SESSION_REFRESH_INTERVAL_SECONDS,
  session_max_per_user: envVars.SESSION_MAX_PER_USER,
};
