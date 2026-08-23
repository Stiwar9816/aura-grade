import { BadGatewayException, Inject, Injectable, Logger } from '@nestjs/common';
// Crypto
import { createHash, randomBytes } from 'crypto';
// AI Provider
import { AI_PROVIDER_TOKEN } from './ai-provider.factory';
import { IAiProvider } from './interfaces/ai-provider.interface';
import { RedisService } from '../redis';
import {
  GeneratedRubric,
  GeneratedRubricCriterion,
  GenerateRubricRequest,
} from './interfaces/rubric-generation.interface';
import {
  RUBRIC_LEVEL_RANGES,
  RUBRIC_MAX_SCORE,
  RUBRIC_PROMPT_VERSION,
  RUBRIC_WEIGHT_TOTAL,
} from '../rubric/rubric.constants';
import { AiSanitizer } from '../common/helpers/ai-sanitizer.helper';

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
        `Falló la lectura de la caché de IA: ${error instanceof Error ? error.message : 'error desconocido'}`
      );
    }

    // Si no está en caché, evaluar y guardar
    const rawResult = await this.aiProvider.evaluateSubmission(
      extractedText,
      rubric,
      assignmentTitle
    );
    const result = this.validateWeightedEvaluation(rawResult, rubric);

    // Guardar en caché por 24 horas (opcional)
    try {
      await this.redis.client.set(cacheKey, JSON.stringify(result), {
        PX: 86400000,
      });
    } catch (error) {
      this.logger.warn(
        `Falló la escritura de la caché de IA: ${error instanceof Error ? error.message : 'error desconocido'}`
      );
    }

    return result;
  }

  async generateRubricDraft(
    input: GenerateRubricRequest,
    userId: string
  ): Promise<GeneratedRubric> {
    const sanitizedInput: GenerateRubricRequest = {
      ...input,
      title: AiSanitizer.cleanPromptInput(input.title, 200),
      taskDescription: AiSanitizer.cleanPromptInput(input.taskDescription, 12000),
      additionalInstructions: input.additionalInstructions
        ? AiSanitizer.cleanPromptInput(input.additionalInstructions, 2000)
        : undefined,
    };
    const raw = await this.aiProvider.generateRubric(sanitizedInput);
    const draft = this.validateGeneratedRubric(raw, sanitizedInput);
    const generationToken = randomBytes(32).toString('base64url');
    const cacheKey = this.rubricGenerationKey(generationToken);
    await this.redis.client.set(
      cacheKey,
      JSON.stringify({
        userId,
        model: draft.model,
        promptVersion: draft.promptVersion,
      }),
      { PX: 30 * 60 * 1000 }
    );
    return { ...draft, generationToken };
  }

  async verifyRubricGeneration(
    generationToken: string,
    userId: string
  ): Promise<{ model: string; promptVersion: string }> {
    const raw = await this.redis.client.get(this.rubricGenerationKey(generationToken));
    if (!raw)
      throw new BadGatewayException('El borrador generado por IA expiró. Genera uno nuevo.');
    let metadata: { userId?: string; model?: string; promptVersion?: string };
    try {
      metadata = JSON.parse(raw);
    } catch {
      throw new BadGatewayException('El borrador generado por IA no es válido.');
    }
    if (metadata.userId !== userId || !metadata.model || !metadata.promptVersion)
      throw new BadGatewayException('El borrador generado por IA no pertenece al docente actual.');
    return { model: metadata.model, promptVersion: metadata.promptVersion };
  }

  async consumeRubricGeneration(generationToken: string): Promise<void> {
    await this.redis.client.del(this.rubricGenerationKey(generationToken));
  }

  private rubricGenerationKey(token: string): string {
    return `ai-rubric-generation:${createHash('sha256').update(token).digest('hex')}`;
  }

  private validateGeneratedRubric(
    raw: GeneratedRubric,
    input: GenerateRubricRequest
  ): GeneratedRubric {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.criteria))
      throw new BadGatewayException('La IA devolvió una rúbrica con formato inválido.');

    const expectedCount = input.criterionCount ?? 4;
    if (raw.criteria.length !== expectedCount)
      throw new BadGatewayException(
        `La IA debía generar ${expectedCount} criterios y devolvió ${raw.criteria.length}.`
      );

    const titles = new Set<string>();
    const criteria = raw.criteria.map((criterion, index) => {
      const normalized = this.validateCriterion(criterion, index);
      const key = normalized.title.toLocaleLowerCase('es');
      if (titles.has(key))
        throw new BadGatewayException('La IA generó criterios duplicados en la rúbrica.');
      titles.add(key);
      return normalized;
    });

    const rawWeight = criteria.reduce((sum, criterion) => sum + criterion.weight, 0);
    if (!Number.isFinite(rawWeight) || rawWeight <= 0)
      throw new BadGatewayException('La IA devolvió porcentajes inválidos.');

    let allocated = 0;
    const normalizedCriteria = criteria.map((criterion, index) => {
      const weight =
        index === criteria.length - 1
          ? Number((RUBRIC_WEIGHT_TOTAL - allocated).toFixed(2))
          : Number(((criterion.weight / rawWeight) * RUBRIC_WEIGHT_TOTAL).toFixed(2));
      allocated = Number((allocated + weight).toFixed(2));
      return { ...criterion, weight };
    });

    return {
      title: this.requiredText(raw.title || input.title, 'título', 200),
      description: this.requiredText(raw.description, 'descripción', 2000),
      academicLevel: input.academicLevel,
      criteria: normalizedCriteria,
      model: this.aiProvider.modelName,
      promptVersion: RUBRIC_PROMPT_VERSION,
    };
  }

  private validateCriterion(
    criterion: GeneratedRubricCriterion,
    index: number
  ): GeneratedRubricCriterion {
    if (!criterion || typeof criterion !== 'object')
      throw new BadGatewayException(`El criterio ${index + 1} tiene un formato inválido.`);
    const weight = Number(criterion.weight);
    if (!Number.isFinite(weight) || weight <= 0)
      throw new BadGatewayException(`El criterio ${index + 1} tiene un porcentaje inválido.`);
    if (!Array.isArray(criterion.levels) || criterion.levels.length !== RUBRIC_LEVEL_RANGES.length)
      throw new BadGatewayException(
        `El criterio ${index + 1} no contiene los cuatro niveles obligatorios.`
      );

    const descriptions = new Map(
      criterion.levels.map((level) => [
        String(level.label).toLocaleLowerCase('es'),
        level.description,
      ])
    );
    const levels = RUBRIC_LEVEL_RANGES.map((range) => ({
      ...range,
      description: this.requiredText(
        descriptions.get(range.label.toLocaleLowerCase('es')),
        `descriptor ${range.label}`,
        1500
      ),
    }));

    return {
      title: this.requiredText(criterion.title, `título del criterio ${index + 1}`, 160),
      description: this.requiredText(
        criterion.description,
        `descripción del criterio ${index + 1}`,
        1000
      ),
      weight,
      levels,
    };
  }

  private requiredText(value: unknown, field: string, maxLength: number): string {
    if (typeof value !== 'string' || !value.trim())
      throw new BadGatewayException(`La IA no devolvió ${field}.`);
    return value.trim().slice(0, maxLength);
  }

  private validateWeightedEvaluation(raw: any, rubric: any) {
    const criteria = Array.isArray(rubric?.criteria) ? rubric.criteria : [];
    if (!criteria.length || !Array.isArray(raw?.detailedFeedback))
      throw new BadGatewayException('La IA devolvió una evaluación incompleta.');
    const fallbackTotal = criteria.reduce(
      (sum: number, criterion: any) => sum + Number(criterion.maxPoints || 0),
      0
    );
    const feedbackByTitle = new Map<string, any>(
      raw.detailedFeedback.map((item: any) => [
        String(item?.criterion ?? item?.name ?? '')
          .trim()
          .toLocaleLowerCase('es'),
        item,
      ])
    );
    let totalScore = 0;
    const detailedFeedback = criteria.map((criterion: any) => {
      const item = feedbackByTitle.get(String(criterion.title).trim().toLocaleLowerCase('es'));
      if (!item) throw new BadGatewayException(`La IA omitió el criterio “${criterion.title}”.`);
      const score = Number(item.score);
      if (!Number.isFinite(score) || score < 0 || score > RUBRIC_MAX_SCORE)
        throw new BadGatewayException(
          `La IA devolvió una nota inválida para el criterio “${criterion.title}”.`
        );
      const weight = Number(
        criterion.weight ??
          (fallbackTotal > 0 ? (Number(criterion.maxPoints) / fallbackTotal) * 100 : 0)
      );
      if (!Number.isFinite(weight) || weight <= 0)
        throw new BadGatewayException(
          `La rúbrica tiene un porcentaje inválido en “${criterion.title}”.`
        );
      const weightedContribution = Number(((score * weight) / 100).toFixed(2));
      totalScore += weightedContribution;
      return {
        criterionId: criterion.id,
        criterion: criterion.title,
        score: Number(score.toFixed(2)),
        weight: Number(weight.toFixed(2)),
        weightedContribution,
        observations: this.requiredText(
          item.observations ?? item.feedback,
          `retroalimentación del criterio ${criterion.title}`,
          3000
        ),
      };
    });
    return {
      totalScore: Number(Math.min(RUBRIC_MAX_SCORE, totalScore).toFixed(2)),
      generalFeedback: this.requiredText(raw.generalFeedback, 'retroalimentación general', 5000),
      detailedFeedback,
    };
  }
}
