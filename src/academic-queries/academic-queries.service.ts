import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AcademicAccessService } from '../academic-access/academic-access.service';

export type AcademicActivityQuery = { page?: number; limit?: number; upcoming?: boolean };

// Both joins are restricted to the authenticated student; historical attempts use the latest.
const personalJoins = `
  LEFT JOIN assignment_extensions x ON x.assignment_id = a.id AND x.student_id = $1
  LEFT JOIN LATERAL (
    SELECT s.id, s.status, s."createdAt" FROM submissions s
    WHERE s.assignment_id = a.id AND s.student_id = $1
    ORDER BY s."createdAt" DESC, s.id DESC LIMIT 1
  ) s ON true`;
const effectiveDate = 'GREATEST(a."dueDate", x.extended_due_date)';

function submissionView(row: Record<string, any>) {
  return row.submissionId
    ? { id: row.submissionId, submittedAt: row.submittedAt, status: row.submissionStatus }
    : null;
}

/** Public teacher feedback only: never pass arbitrary stored JSON into an assistant. */
function criteriaView(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
    .map((item) => {
      const id = item.criteriaId ?? item.criterionId;
      const name = item.name ?? item.criterion;
      const feedback = item.feedback ?? item.observations;
      return {
        ...(typeof id === 'string' ? { criterionId: id } : {}),
        ...(typeof name === 'string' ? { name } : {}),
        ...(typeof item.score === 'number' && Number.isFinite(item.score)
          ? { score: item.score }
          : {}),
        ...(typeof item.weight === 'number' && Number.isFinite(item.weight)
          ? { weight: item.weight }
          : {}),
        ...(typeof feedback === 'string' ? { feedback } : {}),
      };
    });
}

@Injectable()
export class AcademicQueriesService {
  constructor(
    private readonly db: DataSource,
    private readonly access: AcademicAccessService
  ) {}

  async activities(studentId: string, courseId: string, query: AcademicActivityQuery = {}) {
    return this.access.runForStudentCourse(studentId, courseId, async (context) => {
      const { page = 1, limit = 20, upcoming = false } = query;
      if (
        !Number.isInteger(page) ||
        page < 1 ||
        page > 100000 ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 50 ||
        typeof upcoming !== 'boolean'
      )
        throw new BadRequestException('Paginación o filtro inválido.');
      const parameters = [context.studentId, context.courseId, upcoming];
      const where = `a.course_id = $2 AND a."isActive" = true
        AND (NOT $3::boolean OR ${effectiveDate} >= CURRENT_TIMESTAMP)`;
      const [count] = await this.db.query(
        `SELECT COUNT(*)::int AS total FROM assignments a
         LEFT JOIN assignment_extensions x ON x.assignment_id = a.id AND x.student_id = $1
         WHERE ${where}`,
        parameters
      );
      const rows = await this.db.query(
        `SELECT a.id, a.title, a.description, a."dueDate", ${effectiveDate} AS "effectiveDueDate",
         s.id AS "submissionId", s.status AS "submissionStatus", s."createdAt" AS "submittedAt"
         FROM assignments a ${personalJoins} WHERE ${where}
         ORDER BY ${effectiveDate}, a.id LIMIT $4 OFFSET $5`,
        [...parameters, limit, (page - 1) * limit]
      );
      return {
        page,
        limit,
        total: Number(count.total),
        items: rows.map((row) => ({
          id: row.id,
          title: row.title,
          description: row.description,
          dueDate: row.dueDate,
          effectiveDueDate: row.effectiveDueDate,
          submission: submissionView(row),
        })),
      };
    });
  }

  async result(studentId: string, courseId: string, assignmentId: string) {
    return this.access.runForStudentCourse(studentId, courseId, async (context) => {
      const [row] = await this.db.query(
        `SELECT a.id, a.title, s.id AS "submissionId", s.status AS "submissionStatus",
         s."createdAt" AS "submittedAt", e.id AS "evaluationId", e."totalScore",
         e."generalFeedback", e."detailedFeedback"
         FROM assignments a ${personalJoins}
         LEFT JOIN evaluations e ON e.submission_id = s.id AND e.status = 'PUBLISHED'
         WHERE a.course_id = $2 AND a.id = $3 AND a."isActive" = true`,
        [context.studentId, context.courseId, assignmentId]
      );
      if (!row) throw new NotFoundException('Actividad no disponible.');
      return {
        assignment: { id: row.id, title: row.title },
        submission: submissionView(row),
        state: row.evaluationId
          ? 'PUBLISHED'
          : row.submissionId
            ? 'AWAITING_PUBLICATION'
            : 'NOT_SUBMITTED',
        evaluation: row.evaluationId
          ? {
              id: row.evaluationId,
              totalScore: Number(row.totalScore),
              generalFeedback: row.generalFeedback,
              criteria: criteriaView(row.detailedFeedback),
            }
          : null,
      };
    });
  }
}
