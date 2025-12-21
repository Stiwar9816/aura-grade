import { Injectable } from '@nestjs/common';
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class GeminiHealthIndicator extends HealthIndicator {
  constructor(private readonly config: ConfigService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

    const start = Date.now();
    try {
      // Small request to check connectivity and latency
      await axios.get(url, { timeout: 5000 });
      const duration = Date.now() - start;

      return this.getStatus(key, true, { latency: `${duration}ms` });
    } catch (error) {
      const duration = Date.now() - start;
      throw new HealthCheckError(
        'Gemini API unreachable',
        this.getStatus(key, false, {
          message: error.message,
          latency: `${duration}ms`,
        })
      );
    }
  }
}
