import { BadGatewayException } from '@nestjs/common';
import { AiService } from 'src/ai/ai.service';
import { RubricAcademicLevel, RubricPerformanceLevel } from 'src/rubric/enums';

describe('AiService rubric co-pilot', () => {
  const provider = {
    modelName: 'test-model',
    evaluateSubmission: jest.fn(),
    generateRubric: jest.fn(),
  };
  const redis = {
    client: {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    },
  };
  const service = new AiService(provider as never, redis as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('normalizes generated weights and enforces the four performance ranges', async () => {
    provider.generateRubric.mockResolvedValue({
      title: 'Rúbrica de ensayo',
      description: 'Evalúa un ensayo académico.',
      academicLevel: RubricAcademicLevel.UNIVERSITARIO,
      criteria: [
        {
          title: 'Argumentación',
          description: 'Calidad de los argumentos.',
          weight: 1,
          levels: levelDescriptions('argumentación'),
        },
        {
          title: 'Evidencia',
          description: 'Uso de fuentes y evidencias.',
          weight: 1,
          levels: levelDescriptions('evidencia'),
        },
      ],
    });
    redis.client.set.mockResolvedValue('OK');

    const result = await service.generateRubricDraft(
      {
        title: 'Ensayo',
        taskDescription: 'Elabora un ensayo argumentativo.',
        academicLevel: RubricAcademicLevel.UNIVERSITARIO,
        criterionCount: 2,
      },
      'teacher-id'
    );

    expect(result.criteria.map((criterion) => criterion.weight)).toEqual([50, 50]);
    expect(result.criteria[0].levels).toEqual([
      expect.objectContaining({
        label: RubricPerformanceLevel.EXCELENTE,
        minScore: 4.5,
        maxScore: 5,
      }),
      expect.objectContaining({ label: RubricPerformanceLevel.BUENO, minScore: 4, maxScore: 4.49 }),
      expect.objectContaining({
        label: RubricPerformanceLevel.ACEPTABLE,
        minScore: 3,
        maxScore: 3.99,
      }),
      expect.objectContaining({
        label: RubricPerformanceLevel.INSUFICIENTE,
        minScore: 0,
        maxScore: 2.99,
      }),
    ]);
    expect(result.generationToken).toBeTruthy();
    expect(redis.client.set).toHaveBeenCalledWith(
      expect.stringMatching(/^ai-rubric-generation:/),
      expect.stringContaining('teacher-id'),
      { PX: 30 * 60 * 1000 }
    );
  });

  it('rejects a generated rubric that omits required levels', async () => {
    provider.generateRubric.mockResolvedValue({
      title: 'Rúbrica',
      description: 'Descripción',
      criteria: [
        {
          title: 'Único',
          description: 'Descripción',
          weight: 100,
          levels: levelDescriptions('criterio').slice(0, 3),
        },
      ],
    });

    await expect(
      service.generateRubricDraft(
        {
          title: 'Tarea',
          taskDescription: 'Descripción de la tarea.',
          academicLevel: RubricAcademicLevel.POSGRADO,
          criterionCount: 1,
        },
        'teacher-id'
      )
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('calculates the final evaluation from criterion scores and weights', async () => {
    redis.client.get.mockResolvedValue(null);
    redis.client.set.mockResolvedValue('OK');
    provider.evaluateSubmission.mockResolvedValue({
      totalScore: 5,
      generalFeedback: 'Retroalimentación general.',
      detailedFeedback: [
        { criterion: 'Argumentación', score: 4.5, observations: 'Argumenta correctamente.' },
        { criterion: 'Evidencia', score: 3.5, observations: 'Debe fortalecer las fuentes.' },
      ],
    });

    const result = await service.evaluateSubmission(
      'Contenido',
      {
        criteria: [
          { id: 'one', title: 'Argumentación', maxPoints: 5, weight: 60 },
          { id: 'two', title: 'Evidencia', maxPoints: 5, weight: 40 },
        ],
      },
      'Ensayo'
    );

    expect(result.totalScore).toBe(4.1);
    expect(result.detailedFeedback).toEqual([
      expect.objectContaining({ score: 4.5, weight: 60, weightedContribution: 2.7 }),
      expect.objectContaining({ score: 3.5, weight: 40, weightedContribution: 1.4 }),
    ]);
  });
});

function levelDescriptions(subject: string) {
  return [
    { label: RubricPerformanceLevel.EXCELENTE, description: `Excelente ${subject}.` },
    { label: RubricPerformanceLevel.BUENO, description: `Buen nivel de ${subject}.` },
    { label: RubricPerformanceLevel.ACEPTABLE, description: `Nivel aceptable de ${subject}.` },
    {
      label: RubricPerformanceLevel.INSUFICIENTE,
      description: `Nivel insuficiente de ${subject}.`,
    },
  ];
}
