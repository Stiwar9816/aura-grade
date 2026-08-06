import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import type * as WebPush from 'web-push';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { AuthMetricsService } from 'src/observability';
import { User } from 'src/user/entities/user.entity';
import { SavePushSubscriptionDto } from './dto/push-subscription.dto';
import { PushSubscriptionEntity } from './entities/push-subscription.entity';

export const WEB_PUSH_CLIENT = Symbol('WEB_PUSH_CLIENT');

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

type WebPushClient = Pick<typeof WebPush, 'sendNotification' | 'setVapidDetails'>;

@Injectable()
export class WebPushService {
  private readonly logger = new Logger(WebPushService.name);
  private readonly publicKey?: string;
  private readonly configured: boolean;

  constructor(
    @InjectRepository(PushSubscriptionEntity)
    private readonly subscriptionRepository: Repository<PushSubscriptionEntity>,
    private readonly configService: ConfigService,
    private readonly metrics: AuthMetricsService,
    @Inject(WEB_PUSH_CLIENT) private readonly client: WebPushClient
  ) {
    const subject = this.configService.get<string>('VAPID_SUBJECT')?.trim();
    const publicKey = this.configService.get<string>('VAPID_PUBLIC_KEY')?.trim();
    const privateKey = this.configService.get<string>('VAPID_PRIVATE_KEY')?.trim();
    this.publicKey = publicKey;
    this.configured = Boolean(subject && publicKey && privateKey);

    if (this.configured) {
      this.client.setVapidDetails(subject, publicKey, privateKey);
    } else {
      this.logger.warn(
        'Web Push está deshabilitado hasta configurar VAPID_SUBJECT, VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY.'
      );
    }
  }

  getPublicKey(): string {
    if (!this.configured || !this.publicKey) {
      throw new ServiceUnavailableException('Las notificaciones Web Push no están configuradas.');
    }
    return this.publicKey;
  }

  async subscribe(user: User, input: SavePushSubscriptionDto, userAgent?: string): Promise<void> {
    this.getPublicKey();
    await this.subscriptionRepository.upsert(
      {
        userId: user.id,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: userAgent?.slice(0, 1000),
        lastUsedAt: new Date(),
      },
      { conflictPaths: ['endpoint'], skipUpdateIfNoValuesChanged: true }
    );
    this.metrics.increment('push_subscribed_total');
  }

  async unsubscribe(user: User, endpoint: string): Promise<boolean> {
    const result = await this.subscriptionRepository.delete({ userId: user.id, endpoint });
    const removed = Boolean(result.affected);
    if (removed) this.metrics.increment('push_unsubscribed_total');
    return removed;
  }

  async sendToUser(userId: string, payload: PushPayload): Promise<number> {
    if (!this.configured) return 0;
    let subscriptions: PushSubscriptionEntity[];
    try {
      subscriptions = await this.subscriptionRepository.find({ where: { userId } });
    } catch (error) {
      this.metrics.increment('push_failed_total');
      this.logger.error(
        `No se pudieron procesar las suscripciones Web Push del usuario ${userId}.`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }

    const results = await Promise.all(
      subscriptions.map((subscription) => this.deliver(subscription, payload))
    );
    if (results.includes('FAILED'))
      throw new ServiceUnavailableException('Web Push falló temporalmente y será reintentado.');
    return results.filter((result) => result === 'SENT').length;
  }

  private async deliver(
    subscription: PushSubscriptionEntity,
    payload: PushPayload
  ): Promise<'SENT' | 'EXPIRED' | 'FAILED'> {
    try {
      await this.client.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify(payload),
        {
          TTL: 300,
          urgency: 'normal',
          topic: createHash('sha256').update(payload.tag).digest('base64url').slice(0, 32),
        }
      );
      this.metrics.increment('push_sent_total');
      try {
        await this.subscriptionRepository.update(subscription.id, { lastUsedAt: new Date() });
      } catch (error) {
        this.logger.warn(
          `Web Push fue entregado, pero no se actualizó la suscripción ${subscription.id}: ${
            error instanceof Error ? error.message : 'error desconocido'
          }`
        );
      }
      return 'SENT';
    } catch (error) {
      const statusCode = (error as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await this.subscriptionRepository.delete(subscription.id);
        this.metrics.increment('push_expired_total');
        return 'EXPIRED';
      }
      this.metrics.increment('push_failed_total');
      this.logger.error(
        `No se pudo entregar Web Push para la suscripción ${subscription.id}.`,
        error instanceof Error ? error.stack : undefined
      );
      return 'FAILED';
    }
  }
}
