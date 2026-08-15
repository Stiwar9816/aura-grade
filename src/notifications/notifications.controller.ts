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
  Query,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/auth/decorators';
import { JwtAuthGuard } from 'src/auth/guards';
import { User } from 'src/user/entities/user.entity';
import { UserRoles } from 'src/auth/enums';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { RemovePushSubscriptionDto, SavePushSubscriptionDto } from './dto/push-subscription.dto';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ description: 'Centro de notificaciones del usuario actual.' })
  listNotifications(@CurrentUser() user: User, @Query() query: ListNotificationsDto) {
    return this.notificationsService.listNotifications(user, query);
  }

  @Patch('read-all')
  @ApiOkResponse({ description: 'Marca como leídas todas las notificaciones del usuario actual.' })
  markAllNotificationsRead(@CurrentUser() user: User) {
    return this.notificationsService.markAllNotificationsRead(user);
  }

  @Patch(':id/read')
  @ApiOkResponse({ description: 'Marca como leída una notificación del usuario actual.' })
  markNotificationRead(@CurrentUser() user: User, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.notificationsService.markNotificationRead(user, id);
  }

  @Get('assignments/:assignmentId/reminder-preview')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ description: 'Destinatarios pendientes y disponibles para el recordatorio.' })
  getAssignmentReminderPreview(
    @CurrentUser([UserRoles.Docente]) user: User,
    @Param('assignmentId', new ParseUUIDPipe()) assignmentId: string
  ) {
    return this.notificationsService.getAssignmentReminderPreview(user, assignmentId);
  }

  @Post('assignments/:assignmentId/reminders')
  @ApiOkResponse({ description: 'Recordatorios encolados para estudiantes pendientes.' })
  sendManualAssignmentReminders(
    @CurrentUser([UserRoles.Docente]) user: User,
    @Param('assignmentId', new ParseUUIDPipe()) assignmentId: string
  ) {
    return this.notificationsService.sendManualAssignmentReminders(user, assignmentId);
  }

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
