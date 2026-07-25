import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthMetricsService } from './auth-metrics.service';
import { MetricsAccessGuard } from './metrics-access.guard';
import { MetricsController } from './metrics.controller';

@Global()
@Module({
  imports: [ConfigModule],
  controllers: [MetricsController],
  providers: [AuthMetricsService, MetricsAccessGuard],
  exports: [AuthMetricsService],
})
export class ObservabilityModule {}
