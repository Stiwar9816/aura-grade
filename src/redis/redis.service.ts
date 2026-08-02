import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(RedisService.name);
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
    });
  }

  async onModuleInit(): Promise<void> {
    if (!this.client.isOpen) await this.client.connect();
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.client.isOpen) await this.client.quit();
  }
}
