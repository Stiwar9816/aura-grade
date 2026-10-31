export const TELEGRAM_QUEUE = 'telegram-updates';
export const TELEGRAM_WEBHOOK_SECRET_HEADER = 'x-telegram-bot-api-secret-token';
export const LINK_TOKEN_TTL_MS = 10 * 60 * 1000;
export const LINK_TOKENS_PER_HOUR = 5;
export const UPDATE_DEDUPE_TTL_SECONDS = 2 * 24 * 60 * 60;
export const MESSAGES_PER_MINUTE = 20;
export const MAX_TEXT_LENGTH = 4096;
export const MAX_REPLY_LENGTH = 3900;

export type TelegramJobData = {
  updateId: number;
  chatId: string;
  telegramUserId: string;
  text: string;
};
