export interface EnvVars {
  PORT: number;
  STATE: string;
  DB_PORT: number;
  DB_PASSWORD: string;
  DB_NAME: string;
  DB_HOST: string;
  DB_USERNAME: string;
  JWT_SECRET: string;
  MAIL_FROM: string;
  RESEND_API_KEY: string;
  RESEND_CONFIRMATION_TEMPLATE_ID: string;
  RESEND_UPDATE_PASSWORD_TEMPLATE_ID: string;
  RESEND_RESET_PASSWORD_TEMPLATE_ID: string;
  APP_NAME: string;
  FRONTEND_URL: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
  CLOUDINARY_NAME: string;
  AI_PROVIDER: string;
  OPENAI_API_KEY?: string;
  GEMINI_API_KEY?: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
  BASIC_AUTH_PASSWORD: string;
}
