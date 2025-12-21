import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { BullMQHealthIndicator, GeminiHealthIndicator, OpenaiHealthIndicator } from './indicators';

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
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.bullmq.isHealthy('redis_bullmq'),
      () => this.disk.checkStorage('storage', { path: '/', thresholdPercent: 0.9 }), // 90% threshold
      () => this.gemini.isHealthy('gemini_api'),
      () => this.openai.isHealthy('openai_api'),
    ]);
  }
}
