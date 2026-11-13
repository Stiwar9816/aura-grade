import { ForbiddenException } from '@nestjs/common';
import { UserRoles } from 'src/auth/enums';
import { EvaluationStatus } from 'src/enums';
import { formatSgaScore, SgaGradesService } from 'src/assignment/sga-grades.service';

describe('formatSgaScore', () => {
  it.each([
    ['3.40', '3.4'],
    ['2.99', '2.99'],
    [5, '5.0'],
    ['0.00', '0.0'],
    ['4.25', '4.25'],
  ])('keeps %s as %s without rounding', (input, expected) => {
    expect(formatSgaScore(input)).toBe(expected);
  });
});

describe('SgaGradesService', () => {
  const teacher = { id: 'teacher', role: UserRoles.Docente } as any;
  const student = (id: string, document: number, name: string) => ({
    id,
    role: UserRoles.Estudiante,
    document_num: document,
    name,
    last_name: 'Prueba',
  });
  const evaluation = (totalScore: string, status: EvaluationStatus, createdAt: string) => ({
    totalScore,
    status,
    createdAt: new Date(createdAt),
  });
  const assignmentWith = (submissions: any[], ownerId = 'teacher') => ({
    id: 'assignment-id',
    title: 'Quiz',
    user: { id: ownerId },
    course: {
      course_name: 'Sistemas',
      code_course: 'PGINS2301QDOA',
      sga_subject_code: '000067',
      users: [
        student('a', 1077997926, 'Ana'),
        student('b', 1078457571, 'Beto'),
        student('c', 3, 'Carla'),
      ],
    },
    submissions,
  });
  const build = (assignment: unknown, actor = teacher) =>
    new SgaGradesService({ findOne: jest.fn().mockResolvedValue(assignment) } as any).build(
      'assignment-id',
      actor
    );

  it('exports only published scores, in text with a decimal point and no rounding', async () => {
    const file = await build(
      assignmentWith([
        {
          student: { id: 'a' },
          evaluation: evaluation('2.99', EvaluationStatus.PUBLISHED, '2026-11-01'),
        },
        {
          student: { id: 'b' },
          evaluation: evaluation('4.50', EvaluationStatus.DRAFT, '2026-11-01'),
        },
      ])
    );

    expect(file.course).toEqual({
      name: 'Sistemas',
      code: 'PGINS2301QDOA',
      subjectCode: '000067',
    });
    expect(file.grades).toEqual([
      { document: '1077997926', name: 'Ana Prueba', score: '2.99', status: 'published' },
      { document: '1078457571', name: 'Beto Prueba', score: null, status: 'missing' },
      { document: '3', name: 'Carla Prueba', score: null, status: 'missing' },
    ]);
  });

  it('uses the newest published evaluation when a student submitted more than once', async () => {
    const file = await build(
      assignmentWith([
        {
          student: { id: 'a' },
          evaluation: evaluation('2.00', EvaluationStatus.PUBLISHED, '2026-11-01'),
        },
        {
          student: { id: 'a' },
          evaluation: evaluation('3.80', EvaluationStatus.PUBLISHED, '2026-11-05'),
        },
      ])
    );

    expect(file.grades.find((row) => row.document === '1077997926')?.score).toBe('3.8');
  });

  it('rejects other teachers and non-teachers', async () => {
    await expect(build(assignmentWith([], 'someone-else'))).rejects.toThrow(ForbiddenException);
    await expect(
      build(assignmentWith([]), { id: 'x', role: UserRoles.Estudiante } as any)
    ).rejects.toThrow(ForbiddenException);
  });
});
