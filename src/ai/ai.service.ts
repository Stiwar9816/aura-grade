import { Inject, Injectable } from '@nestjs/common';
// Cache Manager
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
// Crypto
import { createHash } from 'crypto';
// AI Provider
import { AI_PROVIDER_TOKEN } from './ai-provider.factory';
import { IAiProvider } from './interfaces/ai-provider.interface';

@Injectable()
export class AiService {
  constructor(
    @Inject(AI_PROVIDER_TOKEN)
    private readonly aiProvider: IAiProvider,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache
  ) {}

  async evaluateSubmission(extractedText: string, rubric: any, assignmentTitle: string) {
    // Generar una llave única basada en el contenido
    const hash = createHash('sha256')
      .update(`${extractedText}-${JSON.stringify(rubric)}-${assignmentTitle}`)
      .digest('hex');
    const cacheKey = `ai-evaluation:${hash}`;

    // Intentar obtener del caché
    const cachedResult = await this.cacheManager.get(cacheKey);
    if (cachedResult) return cachedResult;

    // Si no está en caché, evaluar y guardar
    const result = await this.aiProvider.evaluateSubmission(extractedText, rubric, assignmentTitle);

    // Guardar en caché por 24 horas (opcional)
    await this.cacheManager.set(cacheKey, result, 86400000);

    return result;
  }
}
