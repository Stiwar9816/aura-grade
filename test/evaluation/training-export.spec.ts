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
  const service = new TrainingExportService(
    { createQueryBuilder: () => qb } as any,
    new ConfigService({ JWT_SECRET: 'x'.repeat(40) })
  );
  return { service, calls };
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
    const { csv, rows } = await fixture().service.export(admin, 'evaluations');
    const { header, lines } = parse(csv);
    expect(header).toEqual([...EVALUATION_COLUMNS]);
    expect(rows).toBe(1);
    const row = lines[0];
    expect(row).toContain('gemini-3.5-flash,grading-v2,DRAFT_CREATED');
    expect(row).toContain(',3,Aceptable,');
    expect(row).toContain(',0,"No cumple, ""revisar""",-3,true,AI_TOO_LENIENT,Copiado,');
  });

  it('pseudonymizes people and never leaks names, emails, ids or the submission text', async () => {
    const { csv } = await fixture().service.export(admin, 'evaluations');
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
    const a = (await f.service.export(admin, 'evaluations')).csv.match(/stu_[0-9a-f]{16}/g)!;
    const b = (await f.service.export(admin, 'criteria')).csv.match(/stu_[0-9a-f]{16}/g)!;
    expect(new Set([...a, ...b]).size).toBe(1);
  });

  it('includes the submission text only when explicitly requested', async () => {
    const { csv } = await fixture().service.export(admin, 'evaluations', true);
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
    const { csv } = await f.service.export(admin, 'evaluations');
    expect(csv).toContain('APPROVED,Revisar c1,Ok,2026-11-05T10:00:00.000Z,2.4,Corregido,OTHER,');
    const criteria = parse((await f.service.export(admin, 'criteria')).csv);
    expect(criteria.lines[0].endsWith(',4,Sí había tesis')).toBe(true);
    expect(criteria.lines[1].endsWith(',,')).toBe(true);
  });

  it('exports one row per rubric criterion, reading legacy field names and escaping formulas', async () => {
    const { csv, rows } = await fixture().service.export(admin, 'criteria');
    const { header, lines } = parse(csv);
    expect(header).toEqual([...CRITERIA_COLUMNS]);
    expect(rows).toBe(2);
    expect(lines[0]).toContain('c1,Argumento,Tesis clara,60,3,Tesis débil,0,Sin tesis,-3,');
    expect(lines[1]).toContain("c2,Redacción,Ortografía,40,3,'=cmd(),0,Ilegible,-3,");
  });

  it('produces only a header when nothing is exportable', async () => {
    const { csv, rows } = await fixture([]).service.export(admin, 'criteria');
    expect(rows).toBe(0);
    expect(parse(csv).lines).toEqual([]);
  });
});

describe('Training export HTTP boundary', () => {
  let app: INestApplication;
  const exports = { export: jest.fn(async () => ({ csv: '\uFEFFa\r\n', rows: 0 })) };
  const config = new ConfigService({ BFF_SHARED_SECRET: 'test-secret', STATE: 'prod' });
  const user = (role: UserRoles) => ({ user: { id: 'u', role, institutionId: 'inst-1' } });
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [TrainingExportController],
      providers: [
        { provide: TrainingExportService, useValue: exports },
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
      false
    );
  });

  it('passes the submission text option only when true', async () => {
    await post('admin').send({ dataset: 'evaluations', includeSubmissionText: true }).expect(200);
    expect(exports.export).toHaveBeenLastCalledWith(expect.anything(), 'evaluations', true);
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
