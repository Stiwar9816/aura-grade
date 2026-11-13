import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRoles } from 'src/auth/enums';
import { EvaluationStatus } from 'src/enums';
import { User } from 'src/user/entities/user.entity';
import { Assignment } from './entities/assignment.entity';

export type SgaGradeStatus = 'published' | 'missing';

export type SgaGradeRow = {
  document: string;
  name: string;
  score: string | null;
  status: SgaGradeStatus;
};

export type SgaGradesFile = {
  format: 'aura-grade-sga-grades';
  version: 1;
  generatedAt: string;
  /** `code` is the SGA group (PGINS2301QDOA), `subjectCode` the subject in it (000067, '' if unset). */
  course: { name: string; code: string; subjectCode: string };
  assignment: { id: string; title: string };
  grades: SgaGradeRow[];
};

/**
 * Scores are copied exactly as published: no rounding (2.99 stays 2.99). Only the text shape is
 * normalised, always with a decimal point and at least one decimal ("5" -> "5.0").
 */
export function formatSgaScore(value: number | string): string {
  const score = Number(value);
  if (!Number.isFinite(score)) throw new Error('La nota publicada no es numérica.');
  // The column has scale 2, so toFixed(2) only pads zeros; it never changes the stored value.
  const [integer, fraction] = score.toFixed(2).split('.');
  return `${integer}.${fraction.replace(/0+$/, '') || '0'}`;
}

@Injectable()
export class SgaGradesService {
  constructor(@InjectRepository(Assignment) private readonly assignments: Repository<Assignment>) {}

  /**
   * Published grades of one assignment keyed by the student's document number, which is the RA the
   * university system shows. Students without a published evaluation are listed as `missing` so the
   * teacher decides what to enter; nothing is ever defaulted to 0.
   */
  async build(assignmentId: string, actor: User): Promise<SgaGradesFile> {
    if (actor.role !== UserRoles.Docente)
      throw new ForbiddenException('Solo un docente puede exportar notas.');

    const assignment = await this.assignments.findOne({
      where: { id: assignmentId },
      relations: [
        'user',
        'course',
        'course.users',
        'submissions',
        'submissions.student',
        'submissions.evaluation',
      ],
    });
    if (!assignment) throw new NotFoundException('No se encontró la tarea.');
    if (assignment.user?.id !== actor.id)
      throw new ForbiddenException('La tarea no pertenece al docente actual.');

    // Several submissions of one student: the newest one with a published evaluation wins.
    const published = new Map<string, { score: string; at: number }>();
    for (const submission of assignment.submissions ?? []) {
      const evaluation = submission.evaluation;
      if (!evaluation || evaluation.status !== EvaluationStatus.PUBLISHED || !submission.student)
        continue;
      const at = new Date(evaluation.createdAt).getTime();
      const current = published.get(submission.student.id);
      if (!current || at > current.at)
        published.set(submission.student.id, { score: formatSgaScore(evaluation.totalScore), at });
    }

    const students = (assignment.course?.users ?? []).filter(
      (student) => student.role === UserRoles.Estudiante && student.document_num != null
    );
    const grades = students
      .map((student): SgaGradeRow => {
        const found = published.get(student.id);
        return {
          document: String(student.document_num),
          name: `${student.name} ${student.last_name}`.trim(),
          score: found?.score ?? null,
          status: found ? 'published' : 'missing',
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));

    return {
      format: 'aura-grade-sga-grades',
      version: 1,
      generatedAt: new Date().toISOString(),
      course: {
        name: assignment.course?.course_name ?? '',
        code: assignment.course?.code_course ?? '',
        subjectCode: assignment.course?.sga_subject_code ?? '',
      },
      assignment: { id: assignment.id, title: assignment.title },
      grades,
    };
  }
}
