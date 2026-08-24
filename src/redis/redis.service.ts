import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import { captureOperationalException } from 'src/observability';

const SENTRY_REDIS_REPORT_INTERVAL_MS = 60_000;

@Injectable()
export class RedisService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(RedisService.name);
  private lastSentryReportAt = 0;
  readonly client: ReturnType<typeof createClient>;

  constructor(configService: ConfigService) {
    const url = configService.get<string>('REDIS_URL');
    this.client = createClient(
      url
        ? { url, disableOfflineQueue: true }
        : {
            socket: {
              host: configService.get<string>('REDIS_HOST', 'localhost'),
              port: Number(configService.get<number>('REDIS_PORT', 6379)),
            },
            disableOfflineQueue: true,
          }
    );
    this.client.on('error', (error) => {
      this.logger.error(
        `Error de conexión con Redis: ${error instanceof Error ? error.message : 'error desconocido'}`,
        error instanceof Error ? error.stack : undefined
      );
      const now = Date.now();
      if (now - this.lastSentryReportAt >= SENTRY_REDIS_REPORT_INTERVAL_MS) {
        this.lastSentryReportAt = now;
        captureOperationalException(error, {
          component: 'dependency',
          dependency: 'redis',
          operation: 'connection',
        });
      }
    });
  }

  async onModuleInit(): Promise<void> {
    if (!this.client.isOpen) await this.client.connect();
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.client.isOpen) await this.client.quit();
  }
}
