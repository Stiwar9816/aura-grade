import { MAX_TEXT_LENGTH, TelegramJobData } from './telegram.constants';

const isId = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

/**
 * Accepts only a text message from a human in a private chat where the sender is the chat.
 * Groups, channels, edits, bots and every other update kind are ignored (null).
 */
export function parseUpdate(body: unknown): TelegramJobData | null {
  if (!body || typeof body !== 'object') return null;
  const update = body as Record<string, any>;
  const message = update.message;
  if (!isId(update.update_id) || !message || typeof message !== 'object') return null;
  const { chat, from, text } = message;
  if (
    !chat ||
    chat.type !== 'private' ||
    !from ||
    from.is_bot === true ||
    !isId(chat.id) ||
    chat.id !== from.id ||
    typeof text !== 'string' ||
    !text.trim() ||
    text.length > MAX_TEXT_LENGTH
  )
    return null;
  return {
    updateId: update.update_id,
    chatId: String(chat.id),
    telegramUserId: String(from.id),
    text: text.trim(),
  };
}

export type ParsedCommand = { name: string; args: string } | null;

/** `/cmd@BotName args` -> { name: 'cmd', args }. Plain text returns null. */
export function parseCommand(text: string): ParsedCommand {
  const match = /^\/([a-zA-Z_]{1,32})(?:@\w+)?(?:\s+([\s\S]*))?$/.exec(text.trim());
  return match ? { name: match[1].toLowerCase(), args: (match[2] ?? '').trim() } : null;
}
