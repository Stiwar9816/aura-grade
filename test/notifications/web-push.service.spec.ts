import { ServiceUnavailableException } from '@nestjs/common';
import { WebPushService } from 'src/notifications/web-push.service';

describe('WebPushService', () => {
  const repository = {
    upsert: jest.fn(),
    delete: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
  };
  const configValues: Record<string, string | undefined> = {
    VAPID_SUBJECT: 'mailto:admin@auragrade.test',
    VAPID_PUBLIC_KEY: 'public-key-value-that-is-long-enough-for-testing',
    VAPID_PRIVATE_KEY: 'private-key-value-that-is-long-enough-for-testing',
  };
  const config = { get: jest.fn((name: string) => configValues[name]) };
  const metrics = { increment: jest.fn() };
  const client = {
    setVapidDetails: jest.fn(),
    sendNotification: jest.fn(),
  };
  const user = { id: 'user-id' } as any;
  const input = {
    endpoint: 'https://push.example/subscription',
    keys: { p256dh: 'a'.repeat(32), auth: 'b'.repeat(16) },
  };
  const storedSubscription = {
    id: 'subscription-id',
    userId: user.id,
    ...input,
    p256dh: input.keys.p256dh,
    auth: input.keys.auth,
  };
  let service: WebPushService;

  beforeEach(() => {
    jest.clearAllMocks();
    configValues.VAPID_SUBJECT = 'mailto:admin@auragrade.test';
    configValues.VAPID_PUBLIC_KEY = 'public-key-value-that-is-long-enough-for-testing';
    configValues.VAPID_PRIVATE_KEY = 'private-key-value-that-is-long-enough-for-testing';
    repository.upsert.mockResolvedValue(undefined);
    repository.delete.mockResolvedValue({ affected: 1 });
    repository.find.mockResolvedValue([storedSubscription]);
    repository.update.mockResolvedValue({ affected: 1 });
    client.sendNotification.mockResolvedValue({ statusCode: 201 });
    service = new WebPushService(repository as any, config as any, metrics as any, client as any);
  });

  it('configures VAPID and exposes only the public key', () => {
    expect(client.setVapidDetails).toHaveBeenCalledWith(
      configValues.VAPID_SUBJECT,
      configValues.VAPID_PUBLIC_KEY,
      configValues.VAPID_PRIVATE_KEY
    );
    expect(service.getPublicKey()).toBe(configValues.VAPID_PUBLIC_KEY);
  });

  it('upserts a subscription for the authenticated user and current device', async () => {
    await service.subscribe(user, input, 'Test Browser');

    expect(repository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: user.id,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: 'Test Browser',
      }),
      expect.objectContaining({ conflictPaths: ['endpoint'] })
    );
    expect(metrics.increment).toHaveBeenCalledWith('push_subscribed_total');
  });

  it('sends an encrypted payload to every stored device', async () => {
    await service.sendToUser(user.id, {
      title: 'Nueva entrega',
      body: 'Tienes una entrega.',
      url: '/teacher/assignments/1',
      tag: 'submission:1',
    });

    expect(client.sendNotification).toHaveBeenCalledWith(
      {
        endpoint: input.endpoint,
        keys: input.keys,
      },
      expect.stringContaining('Nueva entrega'),
      expect.objectContaining({ TTL: 300, urgency: 'normal' })
    );
    expect(repository.update).toHaveBeenCalledWith(
      storedSubscription.id,
      expect.objectContaining({ lastUsedAt: expect.any(Date) })
    );
    expect(metrics.increment).toHaveBeenCalledWith('push_sent_total');
  });

  it.each([404, 410])(
    'removes an expired subscription on upstream status %s',
    async (statusCode) => {
      client.sendNotification.mockRejectedValueOnce({ statusCode });

      await service.sendToUser(user.id, {
        title: 'Calificación',
        body: 'Publicada',
        url: '/student',
        tag: 'grade:1',
      });

      expect(repository.delete).toHaveBeenCalledWith(storedSubscription.id);
      expect(metrics.increment).toHaveBeenCalledWith('push_expired_total');
    }
  );

  it('keeps a subscription after a transient upstream failure', async () => {
    client.sendNotification.mockRejectedValueOnce({ statusCode: 503 });

    await service.sendToUser(user.id, {
      title: 'Calificación',
      body: 'Publicada',
      url: '/student',
      tag: 'grade:1',
    });

    expect(repository.delete).not.toHaveBeenCalled();
    expect(metrics.increment).toHaveBeenCalledWith('push_failed_total');
  });

  it('rejects subscription setup when VAPID is incomplete', () => {
    configValues.VAPID_PRIVATE_KEY = undefined;
    const unconfigured = new WebPushService(
      repository as any,
      config as any,
      metrics as any,
      client as any
    );

    expect(() => unconfigured.getPublicKey()).toThrow(ServiceUnavailableException);
  });
});
