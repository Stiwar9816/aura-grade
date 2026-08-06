import { Injectable, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as webPush from 'web-push';
import { User } from 'src/user/entities/user.entity';
// Gateways
import { PushSubscriptionEntity } from './entities/push-subscription.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';
import { WEB_PUSH_CLIENT, WebPushService } from './web-push.service';

@Injectable()
class NodeWebPushClient {
  setVapidDetails(...parameters: Parameters<typeof webPush.setVapidDetails>) {
    return webPush.setVapidDetails(...parameters);
  }

  sendNotification(...parameters: Parameters<typeof webPush.sendNotification>) {
    return webPush.sendNotification(...parameters);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([User, PushSubscriptionEntity])],
  controllers: [NotificationsController],
  providers: [
    NotificationsGateway,
    NotificationsService,
    WebPushService,
    { provide: WEB_PUSH_CLIENT, useClass: NodeWebPushClient },
  ],
  exports: [NotificationsGateway, NotificationsService, WebPushService],
})
export class NotificationsModule {}
