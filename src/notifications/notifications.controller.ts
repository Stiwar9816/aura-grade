import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/auth/decorators';
import { JwtAuthGuard } from 'src/auth/guards';
import { User } from 'src/user/entities/user.entity';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { RemovePushSubscriptionDto, SavePushSubscriptionDto } from './dto/push-subscription.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('preferences')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ description: 'Preferencias de notificación del usuario actual.' })
  getPreferences(@CurrentUser() user: User) {
    return this.notificationsService.getPreferences(user);
  }

  @Patch('preferences')
  @ApiOkResponse({ description: 'Preferencias de notificación actualizadas.' })
  updatePreferences(@CurrentUser() user: User, @Body() input: UpdateNotificationPreferencesDto) {
    return this.notificationsService.updatePreferences(user, input);
  }

  @Get('push/public-key')
  @Header('Cache-Control', 'private, max-age=3600')
  getPushPublicKey() {
    return { publicKey: this.notificationsService.getPushPublicKey() };
  }

  @Post('push/subscriptions')
  @HttpCode(HttpStatus.CREATED)
  async subscribePush(
    @CurrentUser() user: User,
    @Body() input: SavePushSubscriptionDto,
    @Headers('user-agent') userAgent?: string
  ) {
    await this.notificationsService.subscribePush(user, input, userAgent);
    return { subscribed: true };
  }

  @Delete('push/subscriptions')
  @HttpCode(HttpStatus.OK)
  async unsubscribePush(@CurrentUser() user: User, @Body() input: RemovePushSubscriptionDto) {
    return { removed: await this.notificationsService.unsubscribePush(user, input.endpoint) };
  }
}
