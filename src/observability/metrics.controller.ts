import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AuthMetricsService } from './auth-metrics.service';
import { MetricsAccessGuard } from './metrics-access.guard';

@Controller('metrics')
@UseGuards(MetricsAccessGuard)
@SkipThrottle()
export class MetricsController {
  constructor(private readonly metrics: AuthMetricsService) {}

  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  getMetrics(): string {
    return this.metrics.renderPrometheus();
  }
}
