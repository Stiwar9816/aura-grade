import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  HttpCode,
  Post,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators';
import { UserRoles } from '../auth/enums';
import { JwtAuthGuard } from '../auth/guards';
import { SkipBffAuth } from '../common/guards/skip-bff-auth.decorator';
import { User } from '../user/entities/user.entity';
import { TELEGRAM_WEBHOOK_SECRET_HEADER } from './telegram.constants';
import { TelegramClient } from './telegram-client';
import { TelegramLinkService } from './telegram-link.service';
import { TelegramUpdatesService } from './telegram-updates.service';

/** Called by Telegram, not by the BFF: it authenticates with its own secret header. */
@Controller('telegram')
export class TelegramWebhookController {
  constructor(private readonly updates: TelegramUpdatesService) {}

  @Post('webhook')
  @HttpCode(200)
  @SkipBffAuth()
  @SkipThrottle({ short: true }) // per-sender limits are applied after authentication
  @Header('Cache-Control', 'no-store')
  webhook(@Headers(TELEGRAM_WEBHOOK_SECRET_HEADER) secret: string, @Body() body: unknown) {
    return this.updates.receive(secret, body);
  }
}

@Controller('telegram/link')
@UseGuards(JwtAuthGuard)
export class TelegramLinkController {
  constructor(
    private readonly links: TelegramLinkService,
    private readonly client: TelegramClient,
    private readonly config: ConfigService
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async status(@CurrentUser([UserRoles.Estudiante]) actor: User) {
    if (!this.client.enabled) return { enabled: false, linked: false };
    return { enabled: true, ...(await this.links.status(actor.id)) };
  }

  @Post('token')
  @Header('Cache-Control', 'no-store')
  async token(@CurrentUser([UserRoles.Estudiante]) actor: User) {
    const bot = this.config.get<string>('TELEGRAM_BOT_USERNAME');
    if (!this.client.enabled || !bot)
      throw new ServiceUnavailableException('Telegram no está habilitado.');
    const { token, expiresAt } = await this.links.createToken(actor.id);
    return { url: `https://t.me/${bot}?start=${token}`, expiresAt };
  }

  @Delete()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async unlink(@CurrentUser([UserRoles.Estudiante]) actor: User) {
    return { revoked: await this.links.revoke(actor.id) };
  }
}
