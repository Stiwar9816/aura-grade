import { validate } from 'class-validator';
import { NotificationsController } from 'src/notifications/notifications.controller';
import {
  PushSubscriptionKeysDto,
  RemovePushSubscriptionDto,
  SavePushSubscriptionDto,
} from 'src/notifications/dto/push-subscription.dto';
import { User } from 'src/user/entities/user.entity';

describe('NotificationsController', () => {
  const notificationsService = {
    getPreferences: jest.fn(),
    updatePreferences: jest.fn(),
    getPushPublicKey: jest.fn(),
    subscribePush: jest.fn(),
    unsubscribePush: jest.fn(),
  };
  const controller = new NotificationsController(notificationsService as any);
  const user = { id: '123e4567-e89b-12d3-a456-426614174000' } as User;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns only the public VAPID key', () => {
    notificationsService.getPushPublicKey.mockReturnValue('public-key');

    expect(controller.getPushPublicKey()).toEqual({ publicKey: 'public-key' });
  });

  it('registers a subscription for the authenticated user', async () => {
    const input = {
      endpoint: 'https://push.example/subscription',
      keys: { p256dh: 'a'.repeat(32), auth: 'b'.repeat(16) },
    } as SavePushSubscriptionDto;
    notificationsService.subscribePush.mockResolvedValue(undefined);

    await expect(controller.subscribePush(user, input, 'Test Browser')).resolves.toEqual({
      subscribed: true,
    });
    expect(notificationsService.subscribePush).toHaveBeenCalledWith(user, input, 'Test Browser');
  });

  it('removes only the current user subscription', async () => {
    const input = {
      endpoint: 'https://push.example/subscription',
    } as RemovePushSubscriptionDto;
    notificationsService.unsubscribePush.mockResolvedValue(true);

    await expect(controller.unsubscribePush(user, input)).resolves.toEqual({ removed: true });
    expect(notificationsService.unsubscribePush).toHaveBeenCalledWith(user, input.endpoint);
  });
});

describe('Push subscription DTO validation', () => {
  it('accepts the browser subscription shape', async () => {
    const input = Object.assign(new SavePushSubscriptionDto(), {
      endpoint: 'https://push.example/subscription',
      expirationTime: null,
      keys: Object.assign(new PushSubscriptionKeysDto(), {
        p256dh: 'a'.repeat(32),
        auth: 'b'.repeat(16),
      }),
    });

    await expect(validate(input)).resolves.toEqual([]);
  });

  it('rejects insecure endpoints', async () => {
    const input = Object.assign(new RemovePushSubscriptionDto(), {
      endpoint: 'http://push.example/subscription',
    });

    expect(await validate(input)).not.toHaveLength(0);
  });
});
