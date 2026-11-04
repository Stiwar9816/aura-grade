import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CourseDocumentsService } from 'src/course-documents/course-documents.service';
import { CourseDocument } from 'src/course-documents/entities/course-document.entity';
import { CourseDocumentVersion } from 'src/course-documents/entities/course-document-version.entity';
import { User } from 'src/user/entities/user.entity';
import { Course } from 'src/course/entities/course.entity';
import { AcademicAccessService } from 'src/academic-access/academic-access.service';
import { UserRoles } from 'src/auth/enums';
import { InstitutionApprovalStatus } from 'src/institution';
import {
  CourseDocumentKind,
  DocumentExtractionState,
  DocumentVersionStatus,
} from 'src/course-documents/document.enums';

describe('CourseDocumentsService', () => {
  const teacher = Object.assign(new User(), {
    id: 'teacher',
    role: UserRoles.Docente,
    institutionId: 'institution',
    isActive: true,
    approvalStatus: InstitutionApprovalStatus.APPROVED,
    institution: { isActive: true },
  });
  const student = Object.assign(new User(), teacher, { id: 'student', role: UserRoles.Estudiante });
  const users = { findOne: jest.fn() };
  const courses = { findOne: jest.fn(), existsBy: jest.fn() };
  const documents = {
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn((v) => v),
    save: jest.fn(async (v) => v),
  };
  const versions = {
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn((v) => v),
    save: jest.fn(async (v) => v),
    update: jest.fn(),
  };
  const manager = {
    getRepository: (entity: unknown) =>
      entity === User
        ? users
        : entity === Course
          ? courses
          : entity === CourseDocument
            ? documents
            : versions,
  };
  const db = { ...manager, transaction: jest.fn(async (work) => work(manager)) };
  const extraction = { extract: jest.fn() };
  const storage = {
    uploadCourseDocument: jest.fn(),
    deleteCourseDocument: jest.fn(),
    courseDocumentDownloadUrl: jest.fn(),
  };
  let service: CourseDocumentsService;
  let document: CourseDocument;
  let version: CourseDocumentVersion;
  const file = {
    originalname: 'guide.pdf',
    mimetype: 'application/pdf',
    buffer: Buffer.from('%PDF-test'),
  };
  const key = '00000000-0000-4000-8000-000000000001';

  beforeEach(() => {
    jest.clearAllMocks();
    users.findOne.mockImplementation(async ({ where }) =>
      where.id === teacher.id ? teacher : student
    );
    courses.findOne.mockResolvedValue({ id: 'course', user: teacher });
    courses.existsBy.mockResolvedValue(true);
    document = Object.assign(new CourseDocument(), {
      id: 'document',
      courseId: 'course',
      title: 'Guía',
      kind: CourseDocumentKind.GUIDE,
      nextVersion: 2,
      lastPublishedVersion: 0,
    });
    version = Object.assign(new CourseDocumentVersion(), {
      id: 'version',
      documentId: document.id,
      version: 1,
      status: DocumentVersionStatus.DRAFT,
      extractionState: DocumentExtractionState.READY,
      extractedText: 'Contenido oficial',
      pages: [],
      contentHash: 'a'.repeat(64),
      storagePublicId: 'auragrade/course-documents/file.pdf',
      reviewedAt: null,
    });
    documents.findOne.mockImplementation(async ({ where }) =>
      where.id === document.id && where.courseId === document.courseId ? document : null
    );
    documents.findAndCount.mockResolvedValue([[document], 1]);
    versions.findOne.mockImplementation(async ({ where }) =>
      where.id === version.id && where.documentId === version.documentId ? version : null
    );
    versions.findAndCount.mockResolvedValue([[version], 1]);
    versions.save.mockImplementation(async (v) => ({ ...v, id: v.id ?? 'new-version' }));
    versions.update.mockResolvedValue({ affected: 1 });
    db.transaction.mockImplementation(async (work) => work(manager));
    extraction.extract.mockResolvedValue({
      format: 'pdf',
      text: 'Contenido oficial',
      pages: [{ page: 1, text: 'Contenido oficial' }],
      state: 'READY',
      contentHash: 'a'.repeat(64),
    });
    storage.uploadCourseDocument.mockResolvedValue({
      publicId: 'auragrade/course-documents/new.pdf',
    });
    storage.deleteCourseDocument.mockResolvedValue(undefined);
    storage.courseDocumentDownloadUrl.mockReturnValue('https://signed.example/file');
    service = new CourseDocumentsService(
      db as never,
      storage as never,
      extraction as never,
      new AcademicAccessService(users as never, courses as never)
    );
  });

  it('requires current teacher ownership before extraction or storage', async () => {
    courses.findOne.mockResolvedValue({
      id: 'course',
      user: { ...teacher, id: 'another-teacher' },
    });
    await expect(service.upload('course', document.id, teacher, file, key)).rejects.toBeInstanceOf(
      ForbiddenException
    );
    expect(extraction.extract).not.toHaveBeenCalled();
    expect(storage.uploadCourseDocument).not.toHaveBeenCalled();
  });
  it('blocks inactive authors before creating documents', async () => {
    users.findOne.mockResolvedValue({ ...teacher, isActive: false });
    await expect(
      service.create('course', teacher, { title: 'Guía', kind: CourseDocumentKind.GUIDE })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(documents.save).not.toHaveBeenCalled();
  });
  it('does not expose a draft or sign its file to an enrolled student', async () => {
    await expect(service.detail('course', document.id, version.id, student)).rejects.toBeInstanceOf(
      NotFoundException
    );
    await expect(
      service.download('course', document.id, version.id, student)
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(storage.courseDocumentDownloadUrl).not.toHaveBeenCalled();
  });
  it('allows a published source but exposes no storage identifier or related entities', async () => {
    version.status = DocumentVersionStatus.PUBLISHED;
    const result = await service.detail('course', document.id, version.id, student);
    expect(result.extractedText).toBe('Contenido oficial');
    expect(result).not.toHaveProperty('storagePublicId');
    expect(result).not.toHaveProperty('document');
    expect(await service.download('course', document.id, version.id, student)).toBe(
      'https://signed.example/file'
    );
  });
  it('blocks a formerly enrolled student without signing a file', async () => {
    version.status = DocumentVersionStatus.PUBLISHED;
    courses.existsBy.mockResolvedValue(false);
    await expect(
      service.download('course', document.id, version.id, student)
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(storage.courseDocumentDownloadUrl).not.toHaveBeenCalled();
  });
  it('does not expose a document through a different course or a version through a different document', async () => {
    version.status = DocumentVersionStatus.PUBLISHED;
    await expect(
      service.download('another-course', document.id, version.id, student)
    ).rejects.toBeInstanceOf(NotFoundException);
    version.documentId = 'another-document';
    await expect(
      service.download('course', document.id, version.id, student)
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(storage.courseDocumentDownloadUrl).not.toHaveBeenCalled();
  });
  it('filters student lists to published versions at query time', async () => {
    await service.listVersions('course', document.id, student, 1, 20);
    expect(versions.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: { documentId: document.id, status: 'PUBLISHED' } })
    );
  });
  it('requires review of the same immutable file before publication', async () => {
    await expect(
      service.publish('course', document.id, version.id, teacher)
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.review('course', document.id, version.id, teacher, {
        confirmed: true,
        contentHash: 'b'.repeat(64),
      })
    ).rejects.toBeInstanceOf(ConflictException);
    await service.review('course', document.id, version.id, teacher, {
      confirmed: true,
      contentHash: version.contentHash,
    });
    expect(version.reviewedById).toBe(teacher.id);
    const published = await service.publish('course', document.id, version.id, teacher);
    expect(published.status).toBe('PUBLISHED');
    expect(versions.update).toHaveBeenCalledWith(
      { documentId: document.id, status: 'PUBLISHED' },
      expect.objectContaining({ status: 'ARCHIVED' })
    );
    expect(document.lastPublishedVersion).toBe(1);
  });
  it('cannot review an unreadable source or publish an archive that was never official', async () => {
    version.extractionState = DocumentExtractionState.NEEDS_TEXT;
    await expect(
      service.review('course', document.id, version.id, teacher, {
        confirmed: true,
        contentHash: version.contentHash,
      })
    ).rejects.toBeInstanceOf(BadRequestException);
    version.extractionState = DocumentExtractionState.READY;
    version.status = DocumentVersionStatus.ARCHIVED;
    await expect(
      service.publish('course', document.id, version.id, teacher)
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('reopens the last withdrawn publication with its review and original file intact', async () => {
    document.lastPublishedVersion = 1;
    version.status = DocumentVersionStatus.ARCHIVED;
    version.reviewedAt = new Date();
    version.reviewedById = teacher.id;
    version.publishedAt = new Date('2026-10-20');
    version.archivedAt = new Date('2026-10-21');
    expect(await service.detail('course', document.id, version.id, teacher)).toMatchObject({
      canReopen: true,
    });
    const reopened = await service.publish('course', document.id, version.id, teacher);
    expect(reopened.status).toBe('PUBLISHED');
    expect(reopened.archivedAt).toBeNull();
    expect(document.lastPublishedVersion).toBe(1);
    expect(document.nextVersion).toBe(2);
    expect(version.reviewedById).toBe(teacher.id);
    expect(storage.uploadCourseDocument).not.toHaveBeenCalled();
    await expect(service.detail('course', document.id, version.id, student)).resolves.toMatchObject(
      { status: 'PUBLISHED' }
    );
  });
  it('does not reopen a superseded archive or bypass a missing review', async () => {
    version.status = DocumentVersionStatus.ARCHIVED;
    version.reviewedAt = new Date();
    version.reviewedById = teacher.id;
    document.lastPublishedVersion = 2;
    expect(await service.detail('course', document.id, version.id, teacher)).toMatchObject({
      canReopen: false,
    });
    await expect(
      service.publish('course', document.id, version.id, teacher)
    ).rejects.toBeInstanceOf(ConflictException);
    document.lastPublishedVersion = 1;
    version.reviewedAt = null;
    expect(await service.detail('course', document.id, version.id, teacher)).toMatchObject({
      canReopen: false,
    });
    await expect(
      service.publish('course', document.id, version.id, teacher)
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(versions.save).not.toHaveBeenCalled();
  });
  it('denies reopening to students and inactive owners', async () => {
    document.lastPublishedVersion = 1;
    version.status = DocumentVersionStatus.ARCHIVED;
    version.reviewedAt = new Date();
    version.reviewedById = teacher.id;
    await expect(
      service.publish('course', document.id, version.id, student)
    ).rejects.toBeInstanceOf(ForbiddenException);
    users.findOne.mockResolvedValue({ ...teacher, isActive: false });
    await expect(
      service.publish('course', document.id, version.id, teacher)
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(versions.save).not.toHaveBeenCalled();
  });
  it('rejects publishing an older draft after a newer version was official', async () => {
    document.lastPublishedVersion = 2;
    version.reviewedAt = new Date();
    version.reviewedById = teacher.id;
    await expect(
      service.publish('course', document.id, version.id, teacher)
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('allocates a version under the document lock without publishing it', async () => {
    const result = await service.upload('course', document.id, teacher, file, key);
    expect(result.version).toBe(2);
    expect(result.status).toBe('DRAFT');
    expect(document.nextVersion).toBe(3);
    expect(documents.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: document.id, courseId: 'course' },
        lock: { mode: 'pessimistic_write' },
      })
    );
  });
  it('returns an identical idempotent upload without uploading again', async () => {
    versions.findOne.mockResolvedValue(version);
    expect((await service.upload('course', document.id, teacher, file, key)).id).toBe(version.id);
    expect(storage.uploadCourseDocument).not.toHaveBeenCalled();
  });
  it('rejects reuse of an upload key with different file bytes', async () => {
    versions.findOne.mockResolvedValue({ ...version, contentHash: 'b'.repeat(64) });
    await expect(service.upload('course', document.id, teacher, file, key)).rejects.toBeInstanceOf(
      ConflictException
    );
  });
  it('cleans up a private upload when persistence fails', async () => {
    db.transaction.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(service.upload('course', document.id, teacher, file, key)).rejects.toThrow(
      'database unavailable'
    );
    expect(storage.deleteCourseDocument).toHaveBeenCalledWith('auragrade/course-documents/new.pdf');
  });
  it('rechecks current access after upload and removes the file if the author was deactivated', async () => {
    storage.uploadCourseDocument.mockImplementationOnce(async () => {
      users.findOne.mockResolvedValue({ ...teacher, isActive: false });
      return { publicId: 'auragrade/course-documents/new.pdf' };
    });
    await expect(service.upload('course', document.id, teacher, file, key)).rejects.toBeInstanceOf(
      ForbiddenException
    );
    expect(versions.save).not.toHaveBeenCalled();
    expect(storage.deleteCourseDocument).toHaveBeenCalledWith('auragrade/course-documents/new.pdf');
  });
  it('removes the redundant file if an identical upload won the idempotency race', async () => {
    versions.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(version);
    const result = await service.upload('course', document.id, teacher, file, key);
    expect(result.id).toBe(version.id);
    expect(versions.save).not.toHaveBeenCalled();
    expect(storage.deleteCourseDocument).toHaveBeenCalledWith('auragrade/course-documents/new.pdf');
  });
  it('archives the publication without deleting the original file', async () => {
    await service.archive('course', document.id, teacher);
    expect(versions.update).toHaveBeenCalledWith(
      { documentId: document.id, status: 'PUBLISHED' },
      expect.objectContaining({ status: 'ARCHIVED' })
    );
    expect(storage.deleteCourseDocument).not.toHaveBeenCalled();
  });
});
