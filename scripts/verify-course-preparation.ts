/** Local PostgreSQL integration check. All fixture data and DDL are rolled back. */
import 'reflect-metadata';
import * as assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { AppDataSource } from '../src/config/datasource.config';
import { AddCourseActivityConfirmations1793188800000 } from '../src/migrations/1793188800000-AddCourseActivityConfirmations';
import { CoursePreparationService } from '../src/course-preparation/course-preparation.service';
import { CourseDocumentsService } from '../src/course-documents/course-documents.service';
import { AcademicAccessService } from '../src/academic-access/academic-access.service';
import { AcademicQueriesService } from '../src/academic-queries/academic-queries.service';
import { Submission } from '../src/submission/entities/submission.entity';
import { Evaluation } from '../src/evaluation/entities/evaluation.entity';
import { EvaluationStatus, SubmissionStatus } from '../src/enums';
import { verifyQueryHttp } from './course-pilot/verify-query-http';
import { User } from '../src/user/entities/user.entity';
import { Institution } from '../src/institution/entities/institution.entity';
import { Course } from '../src/course/entities/course.entity';
import { Assignment } from '../src/assignment/entities/assignment.entity';
import { AssignmentExtension } from '../src/assignment/entities/assignment-extension.entity';
import { Rubric } from '../src/rubric/entities/rubric.entity';
import { CourseDocument } from '../src/course-documents/entities/course-document.entity';
import { CourseDocumentVersion } from '../src/course-documents/entities/course-document-version.entity';
import {
  CourseDocumentKind,
  DocumentExtractionState,
  DocumentVersionStatus,
} from '../src/course-documents/document.enums';
import { UserRoles, DocumentType } from '../src/auth/enums';
import { InstitutionApprovalStatus } from '../src/institution/enums/institution-approval-status.enum';
import { ForbiddenException, ConflictException } from '@nestjs/common';

async function main() {
  assert.equal(process.env.STATE, 'dev', 'Only local development is supported');
  assert.ok(['localhost', '127.0.0.1'].includes(process.env.DB_HOST!), 'Local PostgreSQL only');
  const db = await AppDataSource.initialize();
  const runner = db.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();
  try {
    const existing = await runner.hasTable('course_activity_confirmations');
    if (!existing) {
      const migration = new AddCourseActivityConfirmations1793188800000();
      await migration.up(runner);
      await migration.down(runner);
      await migration.up(runner);
    }
    const m = runner.manager;
    const institution = await m
      .getRepository(Institution)
      .save({ name: 'Temporary preparation verification', isActive: true });
    const salt = Date.now() % 10000000000;
    const makeUser = async (role: UserRoles, offset: number) =>
      m.getRepository(User).save(
        m.getRepository(User).create({
          name: 'Test',
          last_name: 'Preparation',
          document_type: Object.values(DocumentType)[0],
          document_num: salt + offset,
          phone: salt + offset,
          email: `preparation-${randomUUID()}@example.invalid`,
          password: 'unusable-test-password',
          role,
          isActive: true,
          approvalStatus: InstitutionApprovalStatus.APPROVED,
          institutionId: institution.id,
        })
      );
    const teacher = await makeUser(UserRoles.Docente, 1),
      student = await makeUser(UserRoles.Estudiante, 2),
      other = await makeUser(UserRoles.Estudiante, 3);
    const course = await m.getRepository(Course).save({
      course_name: 'Temporary preparation',
      code_course: randomUUID(),
      user: teacher,
      users: [student, other],
    });
    const rubric = await m
      .getRepository(Rubric)
      .save({ title: 'Rúbrica de prueba', user: teacher, maxTotalScore: 5 });
    const activity = await m.getRepository(Assignment).save({
      title: 'Actividad de prueba',
      description: 'Instrucciones',
      dueDate: new Date('2026-12-01T15:00:00Z'),
      course,
      user: teacher,
      rubric,
    });
    const source = async (kind: CourseDocumentKind) => {
      const doc = await m
        .getRepository(CourseDocument)
        .save({ courseId: course.id, title: kind, kind, nextVersion: 2, lastPublishedVersion: 1 });
      return m.getRepository(CourseDocumentVersion).save({
        documentId: doc.id,
        version: 1,
        status: DocumentVersionStatus.PUBLISHED,
        originalName: kind + '.pdf',
        format: 'pdf',
        sizeBytes: 100,
        storagePublicId: 'never-uploaded-test-fixture',
        contentHash: 'a'.repeat(64),
        idempotencyKey: randomUUID(),
        extractionState: DocumentExtractionState.READY,
        extractedText: 'Texto de prueba',
        pages: [],
        uploadedById: teacher.id,
        reviewedById: teacher.id,
        reviewedAt: new Date(),
        publishedAt: new Date(),
      });
    };
    const guide = await source(CourseDocumentKind.GUIDE),
      schedule = await source(CourseDocumentKind.SCHEDULE);
    const transactionDb = {
      getRepository: m.getRepository.bind(m),
      query: m.query.bind(m),
      transaction: async (fn) => fn(m),
    };
    const access = new AcademicAccessService(m.getRepository(User), m.getRepository(Course));
    const documents = new CourseDocumentsService(
      transactionDb as never,
      {} as never,
      {} as never,
      access
    );
    const service = new CoursePreparationService(transactionDb as never, documents);
    const queries = new AcademicQueriesService(transactionDb as never, access);
    const list = await service.list(course.id, teacher);
    assert.equal(list.items[0].status, 'UNCONFIRMED');
    const input = {
      confirmed: true,
      guideVersionId: guide.id,
      scheduleVersionId: schedule.id,
      guideSection: 'Actividad 1',
      scheduleSection: 'Semana 1',
      activityHash: list.items[0].activityHash!,
    };
    await service.confirm(course.id, activity.id, teacher, input);
    assert.equal((await service.list(course.id, student)).items[0].status, 'CONFIRMED');
    await m.getRepository(AssignmentExtension).save([
      {
        assignment: activity,
        student,
        grantedBy: teacher,
        extendedDueDate: new Date('2026-12-03T15:00:00Z'),
      },
      {
        assignment: activity,
        student: other,
        grantedBy: teacher,
        extendedDueDate: new Date('2026-12-08T15:00:00Z'),
      },
    ]);
    const personal = (await service.list(course.id, student)).items[0];
    assert.equal(personal.effectiveDueDate.toISOString(), '2026-12-03T15:00:00.000Z');
    assert.equal(personal.activityHash, undefined);
    assert.equal(JSON.stringify(personal).includes(other.id), false);
    const queryItems = await queries.activities(student.id, course.id);
    assert.equal(queryItems.items.length, 1);
    assert.equal(queryItems.items[0].effectiveDueDate.toISOString(), '2026-12-03T15:00:00.000Z');
    assert.equal((await queries.result(student.id, course.id, activity.id)).state, 'NOT_SUBMITTED');
    const ownSubmission = await m.getRepository(Submission).save({
      student,
      assignment: activity,
      status: SubmissionStatus.REVIEW_PENDING,
      extractedText: 'private original submission',
    });
    const otherSubmission = await m.getRepository(Submission).save({
      student: other,
      assignment: activity,
      status: SubmissionStatus.PUBLISHED,
    });
    const ownEvaluation = await m.getRepository(Evaluation).save({
      submission: ownSubmission,
      status: EvaluationStatus.DRAFT,
      totalScore: 0,
      generalFeedback: 'Teacher feedback',
      detailedFeedback: [
        { criteriaId: 'criterion', score: 0, feedback: 'Revise', private: 'never expose' },
      ],
      originalDraftSnapshot: { private: 'never expose' },
    });
    await m.getRepository(Evaluation).save({
      submission: otherSubmission,
      status: EvaluationStatus.PUBLISHED,
      totalScore: 5,
      generalFeedback: 'Other student private feedback',
      detailedFeedback: [],
    });
    assert.equal((await queries.result(student.id, course.id, activity.id)).evaluation, null);
    await m
      .getRepository(Evaluation)
      .update(ownEvaluation.id, { status: EvaluationStatus.PUBLISHED });
    const grade = await queries.result(student.id, course.id, activity.id);
    assert.equal(grade.evaluation?.totalScore, 0);
    assert.equal(grade.evaluation?.generalFeedback, 'Teacher feedback');
    assert.doesNotMatch(JSON.stringify(grade), /Other student|never expose|private original/);
    if (process.env.RUN_HTTP_INTEGRATION === 'true')
      await verifyQueryHttp(m, queries, student, course.id, activity.id);
    const nextActivity = await m.getRepository(Assignment).save({
      title: 'Future sorting check',
      description: 'Fixture',
      dueDate: new Date('2100-01-01T04:59:00Z'),
      course,
      user: teacher,
      rubric,
    });
    await m
      .getRepository(AssignmentExtension)
      .update(
        { assignment: { id: activity.id }, student: { id: student.id } },
        { extendedDueDate: new Date('2101-01-01T04:59:00Z') }
      );
    const upcoming = await queries.activities(student.id, course.id, { upcoming: true, limit: 1 });
    assert.equal(upcoming.total, 2);
    assert.equal(upcoming.items[0].id, nextActivity.id);
    assert.equal(
      (await queries.activities(student.id, course.id, { upcoming: true, limit: 1, page: 2 }))
        .items[0].id,
      activity.id
    );
    await m.getRepository(Assignment).update(nextActivity.id, { isActive: false });
    await assert.rejects(
      queries.result(student.id, course.id, nextActivity.id),
      /Actividad no disponible/
    );
    await documents.archive(course.id, guide.documentId, teacher);
    assert.equal((await service.list(course.id, student)).items[0].guide, null);
    await documents.publish(course.id, guide.documentId, guide.id, teacher);
    assert.equal((await service.list(course.id, student)).items[0].status, 'CONFIRMED');
    await m.getRepository(Assignment).update(activity.id, { description: 'Cambio académico' });
    assert.equal((await service.list(course.id, teacher)).items[0].status, 'NEEDS_REVIEW');
    await assert.rejects(
      service.confirm(course.id, activity.id, teacher, input),
      ConflictException
    );

    // Reuse the same actor object so stale session data cannot grant academic access.
    let providerCalls = 0;
    const provider = async () => {
      providerCalls++;
      return 'synthetic response';
    };
    const denied = async () => {
      await assert.rejects(service.list(course.id, student), ForbiddenException);
      await assert.rejects(documents.list(course.id, student), ForbiddenException);
      await assert.rejects(queries.activities(student.id, course.id), ForbiddenException);
      await assert.rejects(queries.result(student.id, course.id, activity.id), ForbiddenException);
      await assert.rejects(
        access.runForStudentCourse(student.id, course.id, provider),
        ForbiddenException
      );
      assert.equal(providerCalls, 0, 'Denied access must never invoke an AI provider');
    };
    for (const approvalStatus of [
      InstitutionApprovalStatus.PENDING,
      InstitutionApprovalStatus.REJECTED,
    ]) {
      await m.getRepository(User).update(student.id, { approvalStatus });
      await denied();
    }
    await m.getRepository(User).update(student.id, {
      approvalStatus: InstitutionApprovalStatus.APPROVED,
    });
    await m.getRepository(Institution).update(institution.id, { isActive: false });
    await denied();
    await m.getRepository(Institution).update(institution.id, { isActive: true });
    await m.createQueryBuilder().relation(Course, 'users').of(course.id).remove(student.id);
    await denied();
    await m.createQueryBuilder().relation(Course, 'users').of(course.id).add(student.id);
    const foreignInstitution = await m
      .getRepository(Institution)
      .save({ name: 'Temporary foreign institution', isActive: true });
    await m.getRepository(User).update(student.id, { institutionId: foreignInstitution.id });
    await denied();
    await m.getRepository(User).update(student.id, { institutionId: institution.id });

    // Model a job authorized at enqueue time and executed after deactivation.
    await access.requireStudentCourse(student.id, course.id);
    await m.getRepository(User).update(student.id, { isActive: false });
    await denied();
    await m.getRepository(User).update(student.id, { isActive: true });
    assert.equal(
      await access.runForStudentCourse(student.id, course.id, provider),
      'synthetic response'
    );
    assert.equal(providerCalls, 1, 'Reactivation must permit a fresh authorized operation');
    console.log(
      'PostgreSQL: confirmation, source withdrawal/reopening, stale snapshot, personal deadlines, pending/rejected approval, inactive institution, withdrawn enrollment, foreign institution, deactivation before job execution and reactivation passed. Denials invoked no provider; rollback follows.'
    );
  } finally {
    await runner.rollbackTransaction();
    await runner.release();
    await db.destroy();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
