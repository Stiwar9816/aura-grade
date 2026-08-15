import { Injectable, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as webPush from 'web-push';
import { Evaluation } from 'src/evaluation/entities/evaluation.entity';
import { Submission } from 'src/submission/entities/submission.entity';
import { User } from 'src/user/entities/user.entity';
import { Assignment } from 'src/assignment/entities/assignment.entity';
// Gateways
import { NotificationDeliveryEntity } from './entities/notification-delivery.entity';
import { InAppNotificationEntity } from './entities/in-app-notification.entity';
import { PushSubscriptionEntity } from './entities/push-subscription.entity';
import { NOTIFICATIONS_QUEUE } from './notification-queue.constants';
import { NotificationProcessor } from './notification.processor';
import { NotificationQueueEvents } from './notification-queue.events';
import { NotificationQueueService } from './notification-queue.service';
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
  imports: [
    TypeOrmModule.forFeature([
      User,
      Submission,
      Evaluation,
      PushSubscriptionEntity,
      NotificationDeliveryEntity,
      InAppNotificationEntity,
      Assignment,
    ]),
    BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE }),
    BullBoardModule.forFeature({ name: NOTIFICATIONS_QUEUE, adapter: BullMQAdapter }),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsGateway,
    NotificationsService,
    WebPushService,
    NotificationQueueService,
    NotificationProcessor,
    NotificationQueueEvents,
    { provide: WEB_PUSH_CLIENT, useClass: NodeWebPushClient },
  ],
  exports: [NotificationsGateway, NotificationsService, WebPushService, NotificationQueueService],
})
export class NotificationsModule {}
