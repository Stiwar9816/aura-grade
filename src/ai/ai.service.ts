import { Inject, Injectable, Logger } from '@nestjs/common';
// Crypto
import { createHash } from 'crypto';
// AI Provider
import { AI_PROVIDER_TOKEN } from './ai-provider.factory';
import { IAiProvider } from './interfaces/ai-provider.interface';
import { RedisService } from '../redis';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    @Inject(AI_PROVIDER_TOKEN)
    private readonly aiProvider: IAiProvider,
    private readonly redis: RedisService
  ) {}

  async evaluateSubmission(extractedText: string, rubric: any, assignmentTitle: string) {
    // Generar una llave única basada en el contenido
    const hash = createHash('sha256')
      .update(`${extractedText}-${JSON.stringify(rubric)}-${assignmentTitle}`)
      .digest('hex');
    const cacheKey = `ai-evaluation:${hash}`;

    // Intentar obtener del caché
    try {
      const cachedResult = await this.redis.client.get(cacheKey);
      if (cachedResult) return JSON.parse(cachedResult);
    } catch (error) {
      this.logger.warn(
        `AI cache read failed: ${error instanceof Error ? error.message : 'unknown error'}`
      );
    }

    // Si no está en caché, evaluar y guardar
    const result = await this.aiProvider.evaluateSubmission(extractedText, rubric, assignmentTitle);

    // Guardar en caché por 24 horas (opcional)
    try {
      await this.redis.client.set(cacheKey, JSON.stringify(result), {
        PX: 86400000,
      });
    } catch (error) {
      this.logger.warn(
        `AI cache write failed: ${error instanceof Error ? error.message : 'unknown error'}`
      );
    }

    return result;
  }
}
