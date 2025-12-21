import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { BullModule } from '@nestjs/bullmq';
import { HealthController } from './health.controller';
import { BullMQHealthIndicator, GeminiHealthIndicator, OpenaiHealthIndicator } from './indicators';

@Module({
  imports: [
    TerminusModule.forRoot({
      errorLogStyle: 'pretty',
      gracefulShutdownTimeoutMs: 1000,
    }),
    ConfigModule,
    // We register the grading queue here just for health check purposes
    BullModule.registerQueue({
      name: 'grading',
    }),
  ],
  controllers: [HealthController],
  providers: [BullMQHealthIndicator, GeminiHealthIndicator, OpenaiHealthIndicator],
})
export class HealthModule {}
