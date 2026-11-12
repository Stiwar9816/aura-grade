import { ForbiddenException, INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { UserRoles } from 'src/auth/enums';
import { SessionService } from 'src/auth/session';
import { BffAuthGuard } from 'src/common/guards/bff-auth.guard';
import { csvCell, toCsv } from 'src/evaluation/training-export.csv';
import { TrainingExportController } from 'src/evaluation/training-export.controller';
import {
  CRITERIA_COLUMNS,
  EVALUATION_COLUMNS,
  TrainingExportService,
} from 'src/evaluation/training-export.service';
import { GradingHistoryService } from 'src/evaluation/grading-history.service';
import { GradingInsightsService } from 'src/evaluation/grading-insights.service';
import { GradingMemoryService } from 'src/evaluation/grading-memory.service';
import { redactPersonalData } from 'src/common/helpers/personal-data-redactor';

const rubric = {
  id: 'rubric-1',
  title: 'Ensayo',
  maxTotalScore: 5,
  criteria: [
    { id: 'c1', title: 'Argumento', description: 'Tesis clara', weight: 60 },
    { id: 'c2', title: 'Redacción', description: 'Ortografía', weight: 40 },
  ],
};
const context = { contentHash: 'hash-1', extractedText: 'Mi ensayo, de Ana Pérez', rubric };
const evaluation = (over: Record<string, unknown> = {}) => ({
  id: 'eval-1',
  origin: 'AI',
  submission: {
    student: { id: 'student-1', name: 'Ana', last_name: 'Pérez', email: 'ana@example.test' },
    assignment: {
      id: 'assignment-1',
      title: 'Ensayo 1',
      user: { id: 'teacher-1', institutionId: 'inst-1' },
      course: { id: 'course-1', course_name: 'Algoritmos II' },
    },
  },
  originalDraftSnapshot: {
    captureStage: 'DRAFT_CREATED',
    capturedAt: '2026-11-01T10:00:00.000Z',
    origin: 'AI',
    aiModelUsed: 'gemini-3.5-flash',
    promptVersion: 'grading-v2',
    totalScore: 3,
    generalFeedback: 'Aceptable',
    detailedFeedback: [
      { criteriaId: 'c1', score: 3, feedback: 'Tesis débil' },
      { criterionId: 'c2', score: 3, observations: '=cmd()' },
    ],
    context,
  },
  teacherReviewSnapshot: {
    captureStage: 'TEACHER_PUBLICATION',
    capturedAt: '2026-11-02T10:00:00.000Z',
    reviewerId: 'teacher-1',
    totalScore: 0,
    generalFeedback: 'No cumple, "revisar"',
    detailedFeedback: [
      { criteriaId: 'c1', score: 0, feedback: 'Sin tesis' },
      { criteriaId: 'c2', score: 0, feedback: 'Ilegible' },
    ],
    adjustment: { reason: 'AI_TOO_LENIENT', note: 'Copiado' },
    context,
  },
  reevaluationRevisionSnapshot: null,
  reevaluationRequest: null,
  ...over,
});

function fixture(rows: unknown[] = [evaluation()]) {
  const calls: { sql: string; params?: Record<string, unknown> }[] = [];
  const qb: any = {
    innerJoinAndSelect: () => qb,
    leftJoinAndSelect: () => qb,
    where: (sql: string, params?: Record<string, unknown>) => (calls.push({ sql, params }), qb),
    andWhere: (sql: string, params?: Record<string, unknown>) => (calls.push({ sql, params }), qb),
    orderBy: () => qb,
    addOrderBy: () => qb,
    getMany: async () => rows,
  };
  qb.take = (limit: number) => (calls.push({ sql: `take ${limit}` }), qb);
  const history = new GradingHistoryService({ createQueryBuilder: () => qb } as any);
  const config = new ConfigService({ JWT_SECRET: 'x'.repeat(40), GRADING_MEMORY_ENABLED: 'true' });
  const service = new TrainingExportService(history, config);
  return {
    service,
    calls,
    history,
    insights: new GradingInsightsService(history),
    memory: new GradingMemoryService(history, config),
  };
}
const admin = { id: 'a', role: UserRoles.Administrador, institutionId: 'inst-1' } as any;
const parse = (csv: string) => {
  expect(csv.startsWith('\uFEFF')).toBe(true);
  const [header, ...lines] = csv.slice(1).trimEnd().split('\r\n');
  return { header: header.split(','), lines };
};

describe('CSV encoding', () => {
  it('quotes separators, quotes and line breaks', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('dijo "hola"')).toBe('"dijo ""hola"""');
    expect(csvCell('línea 1\nlínea 2')).toBe('"línea 1\nlínea 2"');
  });
  it.each(['=1+1', '+52', '-2', '@SUM(A1)', '\tx'])('neutralizes the formula %p', (value) => {
    expect(csvCell(value).replace(/^"/, '').startsWith("'")).toBe(true);
  });
  it('keeps numbers, including zero and negatives, as numbers', () => {
    expect(csvCell(0)).toBe('0');
    expect(csvCell(-1.5)).toBe('-1.5');
    expect(csvCell(null)).toBe('');
    expect(csvCell(false)).toBe('false');
  });
  it('writes a BOM, a header and CRLF rows', () => {
    expect(toCsv(['a', 'b'], [{ a: 1, b: 'x' }])).toBe('\uFEFFa,b\r\n1,x\r\n');
  });
});

describe('Training export', () => {
  it.each([UserRoles.Docente, UserRoles.Estudiante])('refuses role %s', async (role) => {
    const f = fixture();
    await expect(f.service.export({ ...admin, role }, 'evaluations')).rejects.toThrow(
      ForbiddenException
    );
    expect(f.calls).toHaveLength(0);
  });

  it('limits an institution administrator to their own institution and complete records', async () => {
    const f = fixture();
    await f.service.export(admin, 'evaluations');
    const sql = f.calls.map((c) => c.sql).join(' | ');
    expect(sql).toContain('e.originalDraftSnapshot IS NOT NULL');
    expect(sql).toContain('e.teacherReviewSnapshot IS NOT NULL');
    expect(f.calls).toContainEqual({
      sql: 'teacher.institutionId = :institutionId',
      params: { institutionId: 'inst-1' },
    });
    expect(f.calls[0].params).toEqual({ status: 'PUBLISHED' });
  });

  it('does not filter by institution for a platform administrator', async () => {
    const f = fixture();
    await f.service.export({ ...admin, isPlatformAdmin: true }, 'evaluations');
    expect(f.calls.some((c) => c.sql.includes('institutionId'))).toBe(false);
  });

  it('exports one row per evaluation with draft, final, delta and a zero grade', async () => {
    const { content: csv, rows } = await fixture().service.export(admin, 'evaluations');
    const { header, lines } = parse(csv);
    expect(header).toEqual([...EVALUATION_COLUMNS]);
    expect(rows).toBe(1);
    const row = lines[0];
    expect(row).toContain('gemini-3.5-flash,grading-v2,DRAFT_CREATED');
    expect(row).toContain(',3,Aceptable,');
    expect(row).toContain(',0,"No cumple, ""revisar""",-3,true,AI_TOO_LENIENT,Copiado,');
  });

  it('pseudonymizes people and never leaks names, emails, ids or the submission text', async () => {
    const { content: csv } = await fixture().service.export(admin, 'evaluations');
    for (const secret of [
      'Ana',
      'Pérez',
      'ana@example.test',
      'student-1',
      'teacher-1',
      'Mi ensayo',
    ])
      expect(csv).not.toContain(secret);
    expect(csv).toMatch(/stu_[0-9a-f]{16}/);
    expect(csv).toMatch(/tch_[0-9a-f]{16}/);
    expect(parse(csv).header).not.toContain('submission_text');
  });

  it('gives the same student the same pseudonym across rows and datasets', async () => {
    const f = fixture([evaluation(), evaluation({ id: 'eval-2' })]);
    const a = (await f.service.export(admin, 'evaluations')).content.match(/stu_[0-9a-f]{16}/g)!;
    const b = (await f.service.export(admin, 'criteria')).content.match(/stu_[0-9a-f]{16}/g)!;
    expect(new Set([...a, ...b]).size).toBe(1);
  });

  it('includes the submission text only when explicitly requested', async () => {
    const { content: csv } = await fixture().service.export(admin, 'evaluations', {
      includeSubmissionText: true,
      redactPersonalData: false,
    });
    expect(parse(csv).header.slice(-1)).toEqual(['submission_text']);
    expect(csv).toContain('"Mi ensayo, de Ana Pérez"');
  });

  it('exports re-evaluation outcome and the later correction', async () => {
    const f = fixture([
      evaluation({
        reevaluationRequest: { status: 'APPROVED', reason: 'Revisar c1', teacherResponse: 'Ok' },
        reevaluationRevisionSnapshot: {
          capturedAt: '2026-11-05T10:00:00.000Z',
          totalScore: 2.4,
          generalFeedback: 'Corregido',
          adjustment: { reason: 'OTHER', note: null },
          detailedFeedback: [{ criteriaId: 'c1', score: 4, feedback: 'Sí había tesis' }],
        },
      }),
    ]);
    const { content: csv } = await f.service.export(admin, 'evaluations');
    expect(csv).toContain('APPROVED,Revisar c1,Ok,2026-11-05T10:00:00.000Z,2.4,Corregido,OTHER,');
    const criteria = parse((await f.service.export(admin, 'criteria')).content);
    expect(criteria.lines[0].endsWith(',4,Sí había tesis')).toBe(true);
    expect(criteria.lines[1].endsWith(',,')).toBe(true);
  });

  it('exports one row per rubric criterion, reading legacy field names and escaping formulas', async () => {
    const { content: csv, rows } = await fixture().service.export(admin, 'criteria');
    const { header, lines } = parse(csv);
    expect(header).toEqual([...CRITERIA_COLUMNS]);
    expect(rows).toBe(2);
    expect(lines[0]).toContain('c1,Argumento,Tesis clara,60,3,Tesis débil,0,Sin tesis,-3,');
    expect(lines[1]).toContain("c2,Redacción,Ortografía,40,3,'=cmd(),0,Ilegible,-3,");
  });

  it('produces only a header when nothing is exportable', async () => {
    const { content: csv, rows } = await fixture([]).service.export(admin, 'criteria');
    expect(rows).toBe(0);
    expect(parse(csv).lines).toEqual([]);
  });
});

describe('Personal data redaction', () => {
  it('removes emails, phone and identity numbers', () => {
    expect(
      redactPersonalData(
        'Escribe a ana.perez@uni.edu.co o al 300 123 4567, CC 1.023.456.789 / 1023456789'
      )
    ).toBe('Escribe a [CORREO] o al [NUMERO], CC [NUMERO] / [NUMERO]');
  });
  it('removes the known names in any case, keeping other words and particles', () => {
    expect(
      redactPersonalData('ANA María de la Peña mejoró; Pérez-Gómez no. Banana y perezoso quedan.', [
        'Ana María',
        'de la Peña Pérez',
      ])
    ).toBe('[NOMBRE] [NOMBRE] de la [NOMBRE] mejoró; [NOMBRE]-Gómez no. Banana y perezoso quedan.');
  });
  it('keeps grades, dates and short numbers', () => {
    const text = 'Nota 4.5 de 5, entrega 2026-11-06, página 18, 120 palabras, 85%.';
    expect(redactPersonalData(text, [])).toBe(text);
  });
  it('tolerates empty and non-text input and regex characters in names', () => {
    expect(redactPersonalData(null)).toBe('');
    // Names are matched literally, never as a pattern.
    expect(redactPersonalData('a (b) c', ['(b)', undefined, 7])).toBe('a [NOMBRE] c');
    expect(redactPersonalData('abc', ['.*'])).toBe('abc');
  });
});

describe('Training export options', () => {
  const personal = () =>
    evaluation({
      teacherReviewSnapshot: {
        ...evaluation().teacherReviewSnapshot,
        generalFeedback: 'Ana, escríbeme a profe@uni.edu',
        detailedFeedback: [
          { criteriaId: 'c1', score: 0, feedback: 'Pérez no citó. Tel 3001234567' },
          { criteriaId: 'c2', score: 0, feedback: 'Ilegible' },
        ],
      },
    });

  it('redacts personal data from free text by default, in every dataset', async () => {
    const f = fixture([personal()]);
    for (const dataset of ['evaluations', 'criteria', 'jsonl'] as const) {
      const { content } = await f.service.export(admin, dataset, { includeSubmissionText: true });
      for (const leak of ['Ana', 'Pérez', 'profe@uni.edu', '3001234567'])
        expect(content).not.toContain(leak);
    }
    const { content } = await f.service.export(admin, 'evaluations', {
      includeSubmissionText: true,
    });
    expect(content).toContain('"[NOMBRE], escríbeme a [CORREO]"');
    expect(content).toContain('"Mi ensayo, de [NOMBRE] [NOMBRE]"');
  });

  it('filters by course', async () => {
    const f = fixture();
    await f.service.export(admin, 'criteria', { courseId: 'course-1' });
    expect(f.calls).toContainEqual({
      sql: 'course.id = :courseId',
      params: { courseId: 'course-1' },
    });
    expect(f.calls).toContainEqual({
      sql: 'teacher.institutionId = :institutionId',
      params: { institutionId: 'inst-1' },
    });
  });

  it('exports one JSON line per evaluation with input, teacher output and draft', async () => {
    const f = fixture([evaluation(), evaluation({ id: 'eval-2' })]);
    const result = await f.service.export(admin, 'jsonl');
    expect(result).toMatchObject({ rows: 2, extension: 'jsonl' });
    const lines = result.content
      .trimEnd()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(lines).toHaveLength(2);
    expect(lines[0].input.rubric.criteria.map((c: any) => c.id)).toEqual(['c1', 'c2']);
    expect(lines[0].input).not.toHaveProperty('submission_text');
    expect(lines[0].output).toEqual({
      total_score: 0,
      general_feedback: 'No cumple, "revisar"',
      criteria: [
        { criterion_id: 'c1', score: 0, feedback: 'Sin tesis' },
        { criterion_id: 'c2', score: 0, feedback: 'Ilegible' },
      ],
    });
    expect(lines[0].draft).toMatchObject({ prompt_version: 'grading-v2', total_score: 3 });
    expect(lines[0].meta).toMatchObject({ score_delta: -3, adjustment_reason: 'AI_TOO_LENIENT' });
    expect(lines[0].meta.student_pseudonym).toMatch(/^stu_[0-9a-f]{16}$/);
    expect(JSON.stringify(lines)).not.toContain('student-1');
  });

  it('uses the re-evaluation correction as the JSONL target', async () => {
    const f = fixture([
      evaluation({
        reevaluationRevisionSnapshot: {
          totalScore: 2.4,
          generalFeedback: 'Corregido',
          adjustment: { reason: 'OTHER', note: null },
          detailedFeedback: [{ criteriaId: 'c1', score: 4, feedback: 'Sí había tesis' }],
        },
      }),
    ]);
    const [line] = (await f.service.export(admin, 'jsonl', { includeSubmissionText: true })).content
      .trimEnd()
      .split('\n')
      .map((l) => JSON.parse(l));
    expect(line.output.total_score).toBe(2.4);
    expect(line.output.criteria[0]).toEqual({
      criterion_id: 'c1',
      score: 4,
      feedback: 'Sí había tesis',
    });
    expect(line.output.criteria[1]).toEqual({ criterion_id: 'c2', score: 0, feedback: 'Ilegible' });
    expect(line.meta).toMatchObject({
      revised_after_reevaluation: true,
      adjustment_reason: 'OTHER',
    });
    expect(line.input.submission_text).toBe('Mi ensayo, de [NOMBRE] [NOMBRE]');
  });

  it('returns an empty JSONL file when nothing is exportable', async () => {
    expect((await fixture([]).service.export(admin, 'jsonl')).content).toBe('');
  });
});

describe('Grading insights', () => {
  const graded = (id: string, draft: number, final: number, over: Record<string, any> = {}) =>
    evaluation({
      id,
      originalDraftSnapshot: {
        ...evaluation().originalDraftSnapshot,
        totalScore: draft,
        detailedFeedback: [
          { criteriaId: 'c1', score: draft },
          { criteriaId: 'c2', score: draft },
        ],
        ...(over.draft ?? {}),
      },
      teacherReviewSnapshot: {
        ...evaluation().teacherReviewSnapshot,
        totalScore: final,
        detailedFeedback: [
          { criteriaId: 'c1', score: final },
          { criteriaId: 'c2', score: draft },
        ],
        adjustment: { reason: over.reason ?? null, note: null },
      },
      reevaluationRequest: over.request ?? null,
    });

  it('refuses non-administrators before reading anything', async () => {
    const f = fixture();
    await expect(f.insights.summary({ ...admin, role: UserRoles.Docente })).rejects.toThrow(
      ForbiddenException
    );
    expect(f.calls).toHaveLength(0);
  });

  it('scopes to the institution and the optional course', async () => {
    const f = fixture([]);
    const summary = await f.insights.summary(admin, 'course-1');
    expect(f.calls).toContainEqual({
      sql: 'course.id = :courseId',
      params: { courseId: 'course-1' },
    });
    expect(f.calls.some((c) => c.sql.includes('institutionId'))).toBe(true);
    expect(summary).toMatchObject({ evaluations: 0, overall: null, byPromptVersion: [] });
  });

  it('measures draft accuracy overall, per criterion and per prompt version', async () => {
    const f = fixture([
      graded('e1', 3, 4, { reason: 'AI_TOO_STRICT' }),
      graded('e2', 3, 3),
      graded('e3', 4, 3, {
        reason: 'AI_TOO_LENIENT',
        draft: { promptVersion: 'grading-v2+memory' },
        request: { status: 'APPROVED' },
      }),
      graded('e4', 4, 4, { draft: { promptVersion: 'grading-v2+memory' } }),
      // Manual drafts are not evidence about the AI.
      graded('e5', 1, 5, { draft: { origin: 'MANUAL' } }),
    ]);
    const s = await f.insights.summary(admin);
    expect(s.evaluations).toBe(4);
    expect(s.overall).toMatchObject({
      evaluations: 4,
      meanAbsoluteDifference: 0.5,
      meanSignedDifference: 0,
      unchangedRate: 0.5,
    });
    expect(s.reevaluationRate).toBe(0.25);
    expect(s.byCourse).toEqual([
      expect.objectContaining({ id: 'course-1', label: 'Algoritmos II', evaluations: 4 }),
    ]);
    const c1 = s.byCriterion.find((c) => c.id === 'rubric-1:c1')!;
    const c2 = s.byCriterion.find((c) => c.id === 'rubric-1:c2')!;
    expect(c1).toMatchObject({ label: 'Ensayo — Argumento', meanAbsoluteDifference: 0.5 });
    expect(c2).toMatchObject({ meanAbsoluteDifference: 0, unchangedRate: 1 });
    const base = s.byPromptVersion.find((v) => v.id.startsWith('grading-v2 ·'))!;
    const memory = s.byPromptVersion.find((v) => v.id.startsWith('grading-v2+memory'))!;
    expect(base).toMatchObject({ evaluations: 2, meanSignedDifference: 0.5, reevaluationRate: 0 });
    expect(memory).toMatchObject({
      evaluations: 2,
      meanSignedDifference: -0.5,
      reevaluationRate: 0.5,
    });
    expect(s.adjustmentReasons).toEqual(
      expect.arrayContaining([
        { reason: 'AI_TOO_STRICT', count: 1 },
        { reason: 'AI_TOO_LENIENT', count: 1 },
      ])
    );
  });

  it('counts the re-evaluation correction as the final grade', async () => {
    const f = fixture([
      evaluation({
        reevaluationRevisionSnapshot: {
          totalScore: 3,
          detailedFeedback: [
            { criteriaId: 'c1', score: 3 },
            { criteriaId: 'c2', score: 3 },
          ],
        },
      }),
    ]);
    const s = await f.insights.summary(admin);
    expect(s.overall).toMatchObject({ meanAbsoluteDifference: 0, unchangedRate: 1 });
  });
});

describe('Grading memory', () => {
  const corrected = evaluation({
    teacherReviewSnapshot: {
      ...evaluation().teacherReviewSnapshot,
      totalScore: 4,
      detailedFeedback: [
        { criteriaId: 'c1', score: 4, feedback: 'Ana sí planteó la tesis, ver ana@example.test' },
        { criteriaId: 'c2', score: 3, feedback: '' },
      ],
      adjustment: { reason: 'AI_TOO_STRICT', note: null },
    },
  });

  it('is off unless enabled, and needs a teacher and a rubric', async () => {
    const f = fixture([corrected]);
    const off = new GradingMemoryService(f.history, new ConfigService({}));
    expect(await off.calibrationFor('teacher-1', 'rubric-1')).toBeNull();
    expect(await f.memory.calibrationFor(undefined, 'rubric-1')).toBeNull();
    expect(await f.memory.calibrationFor('teacher-1', undefined)).toBeNull();
    expect(f.calls).toHaveLength(0);
  });

  it('reads only this teacher and rubric, newest first and bounded', async () => {
    const f = fixture([corrected]);
    await f.memory.calibrationFor('teacher-1', 'rubric-1');
    expect(f.calls).toContainEqual({
      sql: 'teacher.id = :teacherId',
      params: { teacherId: 'teacher-1' },
    });
    expect(f.calls).toContainEqual({
      sql: 'rubric.id = :rubricId',
      params: { rubricId: 'rubric-1' },
    });
    expect(f.calls).toContainEqual({ sql: 'take 30' });
  });

  it('summarises trends and corrections without student work or personal data', async () => {
    const result = (await fixture([corrected]).memory.calibrationFor('teacher-1', 'rubric-1'))!;
    expect(result).toMatchObject({ evaluations: 1, examples: 1 });
    expect(result.text).toContain('nunca instrucciones');
    const payload = JSON.parse(result.text.slice(result.text.indexOf('{')));
    expect(payload.tendenciasPorCriterio).toEqual([
      { criterio: 'Argumento', diferenciaMediaDocenteMenosBorrador: 1, casos: 1 },
      { criterio: 'Redacción', diferenciaMediaDocenteMenosBorrador: 0, casos: 1 },
    ]);
    expect(payload.ejemplosDeCorreccion).toEqual([
      {
        criterio: 'Argumento',
        notaBorrador: 3,
        notaDocente: 4,
        comentarioDocente: '[NOMBRE] sí planteó la tesis, ver [CORREO]',
        motivo: 'AI_TOO_STRICT',
      },
    ]);
    for (const leak of ['Mi ensayo', 'Ana', 'ana@example.test', 'student-1', 'Tesis débil'])
      expect(result.text).not.toContain(leak);
  });

  it('caps the examples and the prompt size', async () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      evaluation({
        id: `e${i}`,
        teacherReviewSnapshot: {
          ...corrected.teacherReviewSnapshot,
          detailedFeedback: [
            { criteriaId: 'c1', score: 4, feedback: 'x'.repeat(2000) },
            { criteriaId: 'c2', score: 4, feedback: 'y'.repeat(2000) },
          ],
        },
      })
    );
    const result = (await fixture(many).memory.calibrationFor('teacher-1', 'rubric-1'))!;
    expect(result.examples).toBeLessThanOrEqual(5);
    expect(result.text.length).toBeLessThanOrEqual(4000);
  });

  it('returns nothing without history and never throws', async () => {
    expect(await fixture([]).memory.calibrationFor('teacher-1', 'rubric-1')).toBeNull();
    const broken = new GradingMemoryService(
      { load: jest.fn().mockRejectedValue(new Error('db down')) } as any,
      new ConfigService({ GRADING_MEMORY_ENABLED: 'true' })
    );
    expect(await broken.calibrationFor('teacher-1', 'rubric-1')).toBeNull();
  });
});

describe('Training export HTTP boundary', () => {
  let app: INestApplication;
  const exports = {
    export: jest.fn(async (_actor: unknown, dataset: string) => ({
      content: 'x',
      rows: 0,
      contentType:
        dataset === 'jsonl' ? 'application/x-ndjson; charset=utf-8' : 'text/csv; charset=utf-8',
      extension: dataset === 'jsonl' ? 'jsonl' : 'csv',
    })),
  };
  const insights = { summary: jest.fn(async () => ({ evaluations: 0 })) };
  const config = new ConfigService({ BFF_SHARED_SECRET: 'test-secret', STATE: 'prod' });
  const user = (role: UserRoles) => ({ user: { id: 'u', role, institutionId: 'inst-1' } });
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [TrainingExportController],
      providers: [
        { provide: TrainingExportService, useValue: exports },
        { provide: GradingInsightsService, useValue: insights },
        {
          provide: SessionService,
          useValue: {
            validate: async (token: string) =>
              token === 'admin'
                ? user(UserRoles.Administrador)
                : token === 'teacher'
                  ? user(UserRoles.Docente)
                  : null,
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    app.useGlobalGuards(new BffAuthGuard(config));
    await app.init();
  });
  afterAll(() => app.close());
  const post = (token?: string) => {
    const r = request(app.getHttpServer())
      .post('/api/evaluations/training-export')
      .set('x-bff-secret', 'test-secret');
    return token ? r.set('Authorization', `Bearer ${token}`) : r;
  };

  it('downloads a private CSV attachment for an administrator', async () => {
    const res = await post('admin').send({ dataset: 'criteria' }).expect(200);
    expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(res.headers['content-disposition']).toMatch(
      /^attachment; filename="aura-grade-criteria-\d{4}-\d{2}-\d{2}\.csv"$/
    );
    expect(res.headers['cache-control']).toBe('no-store');
    expect(exports.export).toHaveBeenLastCalledWith(
      expect.objectContaining({ role: UserRoles.Administrador }),
      'criteria',
      { includeSubmissionText: false, courseId: undefined, redactPersonalData: true }
    );
  });

  it('passes the submission text option only when true', async () => {
    await post('admin').send({ dataset: 'evaluations', includeSubmissionText: true }).expect(200);
    expect(exports.export).toHaveBeenLastCalledWith(
      expect.anything(),
      'evaluations',
      expect.objectContaining({ includeSubmissionText: true })
    );
  });

  it('downloads the JSONL training file and forwards the course filter', async () => {
    const courseId = '00000000-0000-4000-8000-000000000009';
    const res = await post('admin').send({ dataset: 'jsonl', courseId }).expect(200);
    expect(res.headers['content-type']).toBe('application/x-ndjson; charset=utf-8');
    expect(res.headers['content-disposition']).toMatch(/filename="aura-grade-training-.*\.jsonl"$/);
    expect(exports.export).toHaveBeenLastCalledWith(
      expect.anything(),
      'jsonl',
      expect.objectContaining({ courseId, redactPersonalData: true })
    );
    await post('admin').send({ dataset: 'jsonl', courseId: 'not-a-uuid' }).expect(400);
  });

  it('serves grading insights to administrators only', async () => {
    const get = (token: string, query = '') =>
      request(app.getHttpServer())
        .get(`/api/evaluations/grading-insights${query}`)
        .set('x-bff-secret', 'test-secret')
        .set('Authorization', `Bearer ${token}`);
    await get('admin').expect(200).expect('Cache-Control', 'no-store');
    expect(insights.summary).toHaveBeenLastCalledWith(expect.anything(), undefined);
    await get('admin', '?courseId=00000000-0000-4000-8000-000000000009').expect(200);
    await get('admin', '?courseId=x').expect(400);
    await get('admin', '?institutionId=other').expect(400);
    await get('teacher').expect(403);
  });

  it('rejects teachers, anonymous callers, direct access and bad input', async () => {
    exports.export.mockClear();
    await post('teacher').send({ dataset: 'evaluations' }).expect(403);
    await post().send({ dataset: 'evaluations' }).expect(401);
    await request(app.getHttpServer())
      .post('/api/evaluations/training-export')
      .set('Authorization', 'Bearer admin')
      .send({ dataset: 'evaluations' })
      .expect(403);
    await post('admin').send({ dataset: 'users' }).expect(400);
    await post('admin').send({ dataset: 'evaluations', institutionId: 'other' }).expect(400);
    await post('admin').send({ dataset: 'evaluations', includeSubmissionText: 'yes' }).expect(400);
    expect(exports.export).not.toHaveBeenCalled();
  });
});
