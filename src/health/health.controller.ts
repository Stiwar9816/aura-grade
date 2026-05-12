import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { BullMQHealthIndicator, GeminiHealthIndicator, OpenaiHealthIndicator } from './indicators';
import { envs } from 'src/config';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private disk: DiskHealthIndicator,
    private bullmq: BullMQHealthIndicator,
    private gemini: GeminiHealthIndicator,
    private openai: OpenaiHealthIndicator
  ) {}

  @Get()
  @HealthCheck()
  check() {
    const aiProviderCheck =
      envs.ai_provider === 'openai'
        ? () => this.openai.isHealthy('openai_api')
        : () => this.gemini.isHealthy('gemini_api');

    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.bullmq.isHealthy('redis_bullmq'),
      () => this.disk.checkStorage('storage', { path: '/', thresholdPercent: 0.9 }), // 90% threshold
      aiProviderCheck,
    ]);
  }
}
