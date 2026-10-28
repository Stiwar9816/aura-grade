/** Explicit local import; default is a full rollback rehearsal. */
import 'reflect-metadata';
import * as assert from 'node:assert/strict';
import { AppDataSource } from '../src/config/datasource.config';
import { Course } from '../src/course/entities/course.entity';
import { User } from '../src/user/entities/user.entity';
import { Assignment } from '../src/assignment/entities/assignment.entity';
import { AssignmentExtension } from '../src/assignment/entities/assignment-extension.entity';
import { Rubric } from '../src/rubric/entities/rubric.entity';
import { RubricService } from '../src/rubric/rubric.service';
import { AssignmentService } from '../src/assignment/assignment.service';
import { RubricAcademicLevel, RubricPerformanceLevel, RubricSource } from '../src/rubric/enums';
import { CourseDocumentVersion } from '../src/course-documents/entities/course-document-version.entity';
import { AcademicAccessService } from '../src/academic-access/academic-access.service';
import { CourseDocumentsService } from '../src/course-documents/course-documents.service';
import { pilot, activities } from './course-pilot/manifest';
import { normalizePilotWeights } from './course-pilot/weights';

async function main() {
  assert.equal(process.env.STATE, 'dev');
  assert.ok(['localhost', '127.0.0.1'].includes(process.env.DB_HOST!));
  const apply = process.argv.includes('--apply');
  const db = await AppDataSource.initialize();
  const runner = db.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();
  const results: object[] = [];
  try {
    const m = runner.manager;
    const facade = {
      getRepository: m.getRepository.bind(m),
      query: m.query.bind(m),
      transaction: async (fn) => fn(m),
    };
    // Serialize imports of this course without touching unrelated academic data.
    await m
      .getRepository(Course)
      .findOneOrFail({ where: { id: pilot.courseId }, lock: { mode: 'pessimistic_write' } });
    const course = await m
      .getRepository(Course)
      .findOneOrFail({ where: { id: pilot.courseId }, relations: ['user', 'user.institution'] });
    const access = new AcademicAccessService(m.getRepository(User), m.getRepository(Course));
    const documents = new CourseDocumentsService(facade as never, {} as never, {} as never, access);
    await documents.authorize(course.id, course.user.id, true, m);
    const guide = await m
      .getRepository(CourseDocumentVersion)
      .findOneOrFail({ where: { id: pilot.guideVersionId }, relations: ['document'] });
    const schedule = await m
      .getRepository(CourseDocumentVersion)
      .findOneOrFail({ where: { id: pilot.scheduleVersionId }, relations: ['document'] });
    for (const [version, kind] of [
      [guide, 'GUIDE'],
      [schedule, 'SCHEDULE'],
    ] as const) {
      assert.equal(version.document.courseId, course.id);
      assert.equal(version.document.kind, kind);
      assert.equal(version.status, 'PUBLISHED');
      assert.ok(version.reviewedAt && version.extractedText);
    }
    const rubrics = new RubricService(m.getRepository(Rubric), facade as never, {} as never);
    const assignments = new AssignmentService(
      m.getRepository(Assignment),
      m.getRepository(AssignmentExtension),
      m.getRepository(Course),
      rubrics
    );
    for (const item of activities) {
      const tag = {
        coursePilot: { courseId: course.id, guideVersionId: guide.id, activityNumber: item.number },
      };
      const existing = await m.query(
        'SELECT id FROM rubrics WHERE "userId"=$1 AND standardization_metadata @> $2::jsonb',
        [course.user.id, JSON.stringify(tag)]
      );
      assert.ok(existing.length <= 1, 'Importación duplicada: revisar manualmente.');
      const text = guide.pages
        .filter((p) => p.page >= item.firstPage && p.page <= item.lastPage)
        .map((p) => p.text)
        .join('\n\n');
      assert.ok(text.includes(`ACTIVIDAD ${item.number}:`));
      const sourceWeights = item.criteria.map((c) => c[1]);
      const weights = normalizePilotWeights(sourceWeights);
      if (item.proposal)
        assert.equal(item.draftOnly, true, 'Las propuestas deben permanecer en borrador.');
      if (!item.draftOnly)
        assert.equal(
          sourceWeights.reduce((sum, n) => sum + n, 0),
          100
        );
      const note = item.proposal
        ? 'Propuesta asistida por IA: conserva los criterios de la guía; añade pesos iguales de 25% y descriptores de desempeño para revisión docente. Estos pesos y niveles aún no forman parte de la guía oficial.'
        : item.draftOnly
          ? `Borrador normalizado proporcionalmente desde ${sourceWeights.reduce((sum, n) => sum + n, 0)}%. Revisar y actualizar la guía antes de utilizarlo.`
          : 'Transcripción de la rúbrica oficial revisada.';
      const title = `Actividad ${item.number}: ${item.title}`;
      const saved = existing.length
        ? await rubrics.findOne(existing[0].id, course.user)
        : await rubrics.saveDraft(
            {
              title,
              description: `${note} Guía v${guide.version}, páginas ${item.firstPage}–${item.lastPage}.`,
              academicLevel: RubricAcademicLevel.UNIVERSITARIO,
              criteria: item.criteria.map(([name, , ...descriptions], index) => ({
                title: name,
                description: `Criterio de la guía oficial: ${name}.`,
                weight: weights[index],
                levels: Object.values(RubricPerformanceLevel).map((label, levelIndex) => ({
                  label,
                  description: descriptions[levelIndex],
                })),
              })),
            },
            course.user
          );
      if (!existing.length)
        await m.getRepository(Rubric).update(saved.id, {
          ...(item.proposal ? { source: RubricSource.AI } : {}),
          standardizationMetadata: {
            ...tag,
            scheduleVersionId: schedule.id,
            guidePages: [item.firstPage, item.lastPage],
            sourceWeights: item.proposal ? null : sourceWeights,
            ...(item.proposal
              ? {
                  proposedWeights: weights,
                  weightsAndLevelsOrigin: 'ASSISTANT_PROPOSAL',
                  criteriaOrigin: 'PUBLISHED_GUIDE',
                }
              : { normalizedWeights: weights }),
            normalizationApproved: !!item.draftOnly && !item.proposal,
          },
        });
      if (item.draftOnly) {
        results.push({
          activity: item.number,
          rubricId: saved.id,
          result: existing.length
            ? 'existing rubric; unchanged'
            : item.proposal
              ? 'proposed exam rubric draft only'
              : 'normalized draft only',
        });
        continue;
      }
      const previous = await m
        .getRepository(Assignment)
        .findOne({ where: { course: { id: course.id }, title }, relations: ['rubric'] });
      if (previous)
        assert.equal(
          previous.rubric.id,
          saved.id,
          'Ya existe una actividad distinta con ese título.'
        );
      const instructions = text.split(/Criterio de\s+evaluación/)[0].trim();
      assert.ok(item.closingDate, 'Una actividad programada requiere fecha de cierre.');
      const activity =
        previous ??
        (await assignments.create(
          {
            title,
            description: `${instructions}\n\nFuente: guía v${guide.version}, páginas ${item.firstPage}–${item.lastPage}; cronograma v${schedule.version}, Actividad ${item.number}.`,
            courseId: course.id,
            rubricId: saved.id,
            isActive: false,
            dueDate: new Date(`${item.closingDate}T23:59:00-05:00`),
          },
          course.user
        ));
      results.push({
        activity: item.number,
        assignmentId: activity.id,
        result: previous ? 'existing activity; unchanged' : 'inactive activity',
        closingDate: activity.dueDate,
      });
    }
    if (apply) await runner.commitTransaction();
    else await runner.rollbackTransaction();
    console.log(
      JSON.stringify(
        {
          applied: apply,
          results,
          unprogrammedExamDrafts: activities
            .filter((item) => item.proposal)
            .map((item) => item.number),
          reason:
            'Las propuestas de examen se guardan solo como rúbricas DRAFT para revisión docente.',
          coherenceConfirmed: false,
        },
        null,
        2
      )
    );
  } catch (error) {
    if (runner.isTransactionActive) await runner.rollbackTransaction();
    throw error;
  } finally {
    await runner.release();
    await db.destroy();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
