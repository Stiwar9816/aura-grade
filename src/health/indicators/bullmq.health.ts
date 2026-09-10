import { Injectable } from '@nestjs/common';
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class BullMQHealthIndicator extends HealthIndicator {
  constructor(
    // We use the 'grading' queue since it's already used in the project
    @InjectQueue('grading') private readonly gradingQueue: Queue
  ) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.gradingQueue.getJobCounts('waiting');
      return this.getStatus(key, true);
    } catch {
      throw new HealthCheckError(
        'Falló la conexión con BullMQ.',
        this.getStatus(key, false, { message: 'La cola no está disponible.' })
      );
    }
  }
}
