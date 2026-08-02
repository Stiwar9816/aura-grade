import { Body, Controller, Get, Header, Patch, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/auth/decorators';
import { JwtAuthGuard } from 'src/auth/guards';
import { User } from 'src/user/entities/user.entity';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@Controller('notifications/preferences')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ description: 'Preferencias de notificación del usuario actual.' })
  getPreferences(@CurrentUser() user: User) {
    return this.notificationsService.getPreferences(user);
  }

  @Patch()
  @ApiOkResponse({ description: 'Preferencias de notificación actualizadas.' })
  updatePreferences(@CurrentUser() user: User, @Body() input: UpdateNotificationPreferencesDto) {
    return this.notificationsService.updatePreferences(user, input);
  }
}
