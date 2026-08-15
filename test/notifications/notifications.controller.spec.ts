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
    listNotifications: jest.fn(),
    markNotificationRead: jest.fn(),
    markAllNotificationsRead: jest.fn(),
    getAssignmentReminderPreview: jest.fn(),
    sendManualAssignmentReminders: jest.fn(),
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

  it('lists only notifications resolved for the authenticated user', async () => {
    const response = { items: [], unreadCount: 0, total: 0, page: 1, limit: 20, hasMore: false };
    notificationsService.listNotifications.mockResolvedValue(response);

    await expect(controller.listNotifications(user, { page: 1, limit: 20 })).resolves.toBe(
      response
    );
    expect(notificationsService.listNotifications).toHaveBeenCalledWith(user, {
      page: 1,
      limit: 20,
    });
  });

  it('marks a notification as read within the authenticated user scope', async () => {
    notificationsService.markNotificationRead.mockResolvedValue({ id: 'notification-id' });

    await controller.markNotificationRead(user, 'notification-id');

    expect(notificationsService.markNotificationRead).toHaveBeenCalledWith(user, 'notification-id');
  });

  it('marks all notifications as read within the authenticated user scope', async () => {
    notificationsService.markAllNotificationsRead.mockResolvedValue({ updated: 2 });

    await expect(controller.markAllNotificationsRead(user)).resolves.toEqual({ updated: 2 });
    expect(notificationsService.markAllNotificationsRead).toHaveBeenCalledWith(user);
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

  it('previews and sends assignment reminders for the authenticated teacher', async () => {
    notificationsService.getAssignmentReminderPreview.mockResolvedValue({ canSendCount: 2 });
    notificationsService.sendManualAssignmentReminders.mockResolvedValue({ queuedCount: 2 });

    await expect(controller.getAssignmentReminderPreview(user, 'assignment-id')).resolves.toEqual({
      canSendCount: 2,
    });
    await expect(controller.sendManualAssignmentReminders(user, 'assignment-id')).resolves.toEqual({
      queuedCount: 2,
    });
    expect(notificationsService.getAssignmentReminderPreview).toHaveBeenCalledWith(
      user,
      'assignment-id'
    );
    expect(notificationsService.sendManualAssignmentReminders).toHaveBeenCalledWith(
      user,
      'assignment-id'
    );
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
