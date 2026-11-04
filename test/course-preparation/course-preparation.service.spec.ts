import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { CoursePreparationService } from 'src/course-preparation/course-preparation.service';
import { activityFingerprint } from 'src/course-preparation/preparation-fingerprint';
import { Assignment } from 'src/assignment/entities/assignment.entity';
import { CourseActivityConfirmation } from 'src/course-preparation/entities/course-activity-confirmation.entity';
import { CourseDocumentVersion } from 'src/course-documents/entities/course-document-version.entity';
import { CourseDocument } from 'src/course-documents/entities/course-document.entity';
import { AssignmentExtension } from 'src/assignment/entities/assignment-extension.entity';
import { UserRoles } from 'src/auth/enums';

describe('course preparation', () => {
  let service: CoursePreparationService,
    assignment: Assignment,
    guide: any,
    schedule: any,
    saved: any,
    role: UserRoles;
  let access: any, assignments: any, versions: any, confirmations: any, manager: any;
  const teacher: any = { id: 'teacher', role: UserRoles.Docente };
  const input = () => ({
    confirmed: true,
    guideVersionId: 'g',
    scheduleVersionId: 's',
    guideSection: 'Actividad 1',
    scheduleSection: 'Semana 1',
    activityHash: activityFingerprint(assignment),
  });
  beforeEach(() => {
    assignment = {
      id: 'a',
      title: 'Actividad',
      description: 'Resolver caso',
      dueDate: new Date('2026-12-01'),
      isActive: true,
      user: { id: 'teacher' },
      course: { id: 'c' },
      rubric: { id: 'r', title: 'Rúbrica', version: 1, maxTotalScore: 5, criteria: [] },
    } as Assignment;
    guide = {
      id: 'g',
      documentId: 'dg',
      version: 1,
      status: 'PUBLISHED',
      originalName: 'guia.pdf',
      format: 'pdf',
      document: { id: 'dg', courseId: 'c', kind: 'GUIDE', title: 'Guía' },
    };
    schedule = {
      ...guide,
      id: 's',
      documentId: 'ds',
      originalName: 'cronograma.pdf',
      document: { id: 'ds', courseId: 'c', kind: 'SCHEDULE', title: 'Cronograma' },
    };
    saved = undefined;
    role = UserRoles.Docente;
    access = { authorize: jest.fn(async () => role) };
    assignments = {
      findOne: jest.fn(async () => assignment),
      findAndCount: jest.fn(async () => [[assignment], 1]),
    };
    versions = {
      findOne: jest.fn(async ({ where }) => (where.id === 'g' ? guide : schedule)),
      find: jest.fn(async () => [guide, schedule]),
    };
    confirmations = {
      find: jest.fn(async () => (saved ? [saved] : [])),
      create: jest.fn((v) => v),
      save: jest.fn(async (v) => {
        saved = { ...v, guideVersion: guide, scheduleVersion: schedule };
        return saved;
      }),
    };
    manager = {
      getRepository: jest.fn((e) =>
        e === Assignment
          ? assignments
          : e === CourseDocumentVersion
            ? versions
            : e === CourseActivityConfirmation
              ? confirmations
              : e === CourseDocument
                ? {
                    findOne: async ({ where }) =>
                      where.id === 'dg' ? guide.document : schedule.document,
                  }
                : e === AssignmentExtension
                  ? {
                      find: async () => [
                        { assignment: { id: 'a' }, extendedDueDate: new Date('2026-12-05') },
                      ],
                    }
                  : null
      ),
    };
    const db = { ...manager, transaction: async (fn) => fn(manager) };
    service = new CoursePreparationService(db as never, access);
  });
  it('confirms published sources and returns a current calendar reference', async () => {
    await service.confirm('c', 'a', teacher, input());
    const result = await service.list('c', teacher);
    expect(result.items[0]).toMatchObject({
      status: 'CONFIRMED',
      guide: { versionId: 'g', section: 'Actividad 1' },
      schedule: { versionId: 's' },
      dueDate: assignment.dueDate,
    });
    expect(saved.confirmedById).toBe('teacher');
  });
  it('rejects a stale activity snapshot without persisting confirmation', async () => {
    const data = input();
    assignment.dueDate = new Date('2026-12-02');
    await expect(service.confirm('c', 'a', teacher, data)).rejects.toBeInstanceOf(
      ConflictException
    );
    expect(saved).toBeUndefined();
  });
  it.each(['DRAFT', 'ARCHIVED'])('rejects %s source', async (status) => {
    guide.status = status;
    await expect(service.confirm('c', 'a', teacher, input())).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(saved).toBeUndefined();
  });
  it('rejects a document from another course', async () => {
    guide.document.courseId = 'other';
    await expect(service.confirm('c', 'a', teacher, input())).rejects.toBeInstanceOf(
      BadRequestException
    );
  });
  it('rejects swapped document kinds', async () => {
    guide.document.kind = 'MATERIAL';
    await expect(service.confirm('c', 'a', teacher, input())).rejects.toBeInstanceOf(
      BadRequestException
    );
  });
  it('rejects another teacher activity even inside the selected course', async () => {
    assignment.user.id = 'other';
    await expect(service.confirm('c', 'a', teacher, input())).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });
  it('marks confirmation stale on academic edits and hides student references', async () => {
    await service.confirm('c', 'a', teacher, input());
    assignment.title = 'Edited';
    role = UserRoles.Estudiante;
    const result = await service.list('c', { id: 'student' } as never);
    expect(result.items[0]).toMatchObject({ status: 'NEEDS_REVIEW', guide: null, schedule: null });
    expect(result.items[0].activityHash).toBeUndefined();
  });
  it('withdrawal invalidates the confirmation and reopening the same source restores it', async () => {
    await service.confirm('c', 'a', teacher, input());
    guide.status = 'ARCHIVED';
    expect((await service.list('c', teacher)).items[0].status).toBe('NEEDS_REVIEW');
    guide.status = 'PUBLISHED';
    expect((await service.list('c', teacher)).items[0].status).toBe('CONFIRMED');
  });
  it('uses only the authenticated student extension and does not expose other students', async () => {
    role = UserRoles.Estudiante;
    const result = await service.list('c', { id: 'student' } as never);
    expect(result.items[0].effectiveDueDate).toEqual(new Date('2026-12-05'));
    expect(result.items[0]).not.toHaveProperty('extensions');
    expect(result.sources).toEqual([]);
  });
  it('rechecks denied academic access before reading or writing', async () => {
    access.authorize.mockRejectedValue(new ForbiddenException());
    await expect(service.list('c', teacher)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.confirm('c', 'a', teacher, input())).rejects.toBeInstanceOf(
      ForbiddenException
    );
    expect(saved).toBeUndefined();
    expect(assignments.findAndCount).not.toHaveBeenCalled();
  });
});
