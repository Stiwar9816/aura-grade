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
      // Accessing the redis client from the queue
      const client = await this.gradingQueue.client;
      await client.ping();
      return this.getStatus(key, true);
    } catch (error) {
      throw new HealthCheckError(
        'BullMQ connection failed',
        this.getStatus(key, false, { message: error.message })
      );
    }
  }
}
