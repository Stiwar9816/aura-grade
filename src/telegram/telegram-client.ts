import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TelegramClient {
  private readonly logger = new Logger(TelegramClient.name);

  constructor(private readonly config: ConfigService) {}

  get enabled(): boolean {
    return (
      String(this.config.get('TELEGRAM_ENABLED', 'false')) === 'true' &&
      Boolean(this.config.get('TELEGRAM_BOT_TOKEN')) &&
      Boolean(this.config.get('TELEGRAM_WEBHOOK_SECRET'))
    );
  }

  /** Plain text only (no parse_mode): replies may contain student-visible user data. */
  async sendMessage(chatId: string, text: string): Promise<void> {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) throw new Error('Telegram no está configurado.');
    // Never log the URL or the response body: the path contains the bot token.
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      this.logger.warn(`Telegram rechazó el envío (HTTP ${response.status}).`);
      throw new Error(`Telegram sendMessage failed with ${response.status}`);
    }
  }
}
