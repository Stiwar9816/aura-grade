/** Local PostgreSQL integration check. All fixture data and DDL are rolled back. */
import 'reflect-metadata';
import * as assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { AppDataSource } from '../src/config/datasource.config';
import { AddCourseActivityConfirmations1793188800000 } from '../src/migrations/1793188800000-AddCourseActivityConfirmations';
import { CoursePreparationService } from '../src/course-preparation/course-preparation.service';
import { CourseDocumentsService } from '../src/course-documents/course-documents.service';
import { AcademicAccessService } from '../src/academic-access/academic-access.service';
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
    await m.getRepository(User).update(student.id, { isActive: false });
    await assert.rejects(service.list(course.id, student), ForbiddenException);
    console.log(
      'PostgreSQL: migration up/down/up (when pending), real queries, confirmation, source withdrawal/reopening, stale snapshot, personal deadline and inactive access passed. Fixtures rolled back.'
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
