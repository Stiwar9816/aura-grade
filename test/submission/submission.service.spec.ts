import { Assignment } from 'src/assignment/entities/assignment.entity';
import { Submission } from 'src/submission/entities/submission.entity';
import { SubmissionService } from 'src/submission/submission.service';
import { UserRoles } from 'src/auth/enums';
import { EvaluationStatus, SubmissionStatus } from 'src/enums';
import type { User } from 'src/user/entities/user.entity';
import { Readable } from 'stream';

describe('SubmissionService', () => {
  const submissionRepository = {
    exists: jest.fn(),
    manager: { transaction: jest.fn() },
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };
  const assignmentRepository = { findOne: jest.fn() };
  const gradingQueue = { add: jest.fn() };
  const cloudinaryService = {
    uploadSubmission: jest.fn(),
    deleteSubmission: jest.fn(),
  };
  const notificationQueue = { enqueueNewSubmission: jest.fn() };
  const service = new SubmissionService(
    submissionRepository as never,
    assignmentRepository as never,
    gradingQueue as never,
    cloudinaryService as never,
    notificationQueue as never,
    { extractFromBuffer: jest.fn(async () => 'Texto académico') } as never
  );

  const student = {
    id: 'student-id',
    role: UserRoles.Estudiante,
    institutionId: 'institution-id',
    isPlatformAdmin: false,
  } as User;
  const teacher = {
    id: 'teacher-id',
    role: UserRoles.Docente,
    institutionId: 'institution-id',
    isPlatformAdmin: false,
  } as User;
  const makeDocxContent = () => {
    const locals: Buffer[] = [];
    const centrals: Buffer[] = [];
    let offset = 0;
    for (const name of ['[Content_Types].xml', 'word/document.xml']) {
      const filename = Buffer.from(name);
      const data = Buffer.from('x');
      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0);
      local.writeUInt32LE(data.length, 18);
      local.writeUInt32LE(data.length, 22);
      local.writeUInt16LE(filename.length, 26);
      const central = Buffer.alloc(46);
      central.writeUInt32LE(0x02014b50, 0);
      central.writeUInt32LE(data.length, 20);
      central.writeUInt32LE(data.length, 24);
      central.writeUInt16LE(filename.length, 28);
      central.writeUInt32LE(offset, 42);
      const entry = Buffer.concat([local, filename, data]);
      locals.push(entry);
      centrals.push(Buffer.concat([central, filename]));
      offset += entry.length;
    }
    const directory = Buffer.concat(centrals);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(2, 8);
    end.writeUInt16LE(2, 10);
    end.writeUInt32LE(directory.length, 12);
    end.writeUInt32LE(offset, 16);
    return Buffer.concat([...locals, directory, end]);
  };
  const validDocxContent = makeDocxContent();
  const makeFile = (overrides: Record<string, unknown> = {}) => ({
    filename: 'entrega.docx',
    mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    createReadStream: jest.fn(() => Readable.from(validDocxContent)),
    ...overrides,
  });
  const assignment = {
    id: 'assignment-id',
    isActive: true,
    dueDate: new Date(Date.now() + 60_000),
    user: teacher,
    course: { users: [student] },
  };

  const outbox = { execute: jest.fn(), insert: jest.fn(), values: jest.fn(), orIgnore: jest.fn() };
  beforeEach(() => {
    jest.clearAllMocks();
    submissionRepository.findOne.mockResolvedValue(null);
    submissionRepository.exists.mockResolvedValue(false);
    for (const name of ['insert', 'values', 'orIgnore'] as const)
      outbox[name].mockReturnValue(outbox);
    outbox.execute.mockResolvedValue({});
    submissionRepository.manager.transaction.mockImplementation((callback) =>
      callback({
        getRepository: (entity: unknown) =>
          entity === Assignment
            ? assignmentRepository
            : entity === Submission
              ? submissionRepository
              : { createQueryBuilder: () => outbox },
      })
    );
    assignmentRepository.findOne.mockResolvedValue(assignment);
    cloudinaryService.uploadSubmission.mockResolvedValue({
      secureUrl: 'https://example.com/entrega.docx',
      publicId: 'auragrade/submissions/generated.docx',
    });
    cloudinaryService.deleteSubmission.mockResolvedValue(undefined);
    submissionRepository.create.mockImplementation((value) => value);
    submissionRepository.save.mockImplementation((value) => ({ ...value, id: 'submission-id' }));
    submissionRepository.remove.mockResolvedValue(undefined);
    gradingQueue.add.mockResolvedValue(undefined);
    notificationQueue.enqueueNewSubmission.mockResolvedValue('new-submission-submission-id');
    submissionRepository.update.mockResolvedValue({ affected: 1 });
  });

  it('creates a submission with the authenticated student identity', async () => {
    await service.create(
      makeFile() as never,
      { assignmentId: assignment.id, idempotencyKey: '11111111-1111-4111-8111-111111111111' },
      student
    );

    expect(submissionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        assignment: { id: assignment.id },
        student: { id: student.id },
        status: SubmissionStatus.PENDING,
      })
    );
    expect(gradingQueue.add).not.toHaveBeenCalled();
    expect(outbox.values).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'grading', aggregateId: 'submission-id' })
    );
    expect(outbox.values).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'new-submission', aggregateId: 'submission-id' })
    );
  });

  it('rejects a submission from a user who is not a student', async () => {
    await expect(
      service.create(
        makeFile() as never,
        { assignmentId: 'assignment-id', idempotencyKey: '11111111-1111-4111-8111-111111111111' },
        teacher
      )
    ).rejects.toThrow('Solo un estudiante puede crear entregas.');
    expect(assignmentRepository.findOne).not.toHaveBeenCalled();
  });

  it('rejects a student who is not enrolled in the assignment course', async () => {
    assignmentRepository.findOne.mockResolvedValue({
      id: 'assignment-id',
      isActive: true,
      dueDate: new Date(Date.now() + 60_000),
      user: teacher,
      course: { users: [{ id: 'other-student-id' }] },
    });

    await expect(
      service.create(
        makeFile() as never,
        { assignmentId: 'assignment-id', idempotencyKey: '11111111-1111-4111-8111-111111111111' },
        student
      )
    ).rejects.toThrow('No estás matriculado en el curso de esta tarea.');
    expect(cloudinaryService.uploadSubmission).not.toHaveBeenCalled();
  });

  it('accepts a submission after the general deadline when the student has an active extension', async () => {
    assignmentRepository.findOne.mockResolvedValue({
      ...assignment,
      dueDate: new Date(Date.now() - 60_000),
      extensions: [
        {
          student,
          extendedDueDate: new Date(Date.now() + 60_000),
        },
      ],
    });

    await expect(
      service.create(
        makeFile() as never,
        { assignmentId: assignment.id, idempotencyKey: '11111111-1111-4111-8111-111111111111' },
        student
      )
    ).resolves.toEqual(expect.objectContaining({ id: 'submission-id' }));
  });

  it('does not apply another student extension to a late submission', async () => {
    assignmentRepository.findOne.mockResolvedValue({
      ...assignment,
      dueDate: new Date(Date.now() - 60_000),
      extensions: [
        {
          student: { id: 'other-student-id' },
          extendedDueDate: new Date(Date.now() + 60_000),
        },
      ],
    });

    await expect(
      service.create(
        makeFile() as never,
        { assignmentId: assignment.id, idempotencyKey: '11111111-1111-4111-8111-111111111111' },
        student
      )
    ).rejects.toThrow('fecha límite');
    expect(cloudinaryService.uploadSubmission).not.toHaveBeenCalled();
  });

  it('rejects a renamed file whose content is not a DOCX', async () => {
    await expect(
      service.create(
        makeFile({ createReadStream: () => Readable.from(Buffer.from('not-a-docx')) }) as never,
        { assignmentId: assignment.id, idempotencyKey: '11111111-1111-4111-8111-111111111111' },
        student
      )
    ).rejects.toThrow('contenido del archivo no corresponde a un DOCX válido');
    expect(cloudinaryService.uploadSubmission).not.toHaveBeenCalled();
  });

  it('rejects a file above the real 15 MB stream limit', async () => {
    const oversized = Buffer.alloc(15 * 1024 * 1024 + 1);

    await expect(
      service.create(
        makeFile({ createReadStream: () => Readable.from(oversized) }) as never,
        { assignmentId: assignment.id, idempotencyKey: '11111111-1111-4111-8111-111111111111' },
        student
      )
    ).rejects.toThrow('supera el límite de 15 MB');
    expect(cloudinaryService.uploadSubmission).not.toHaveBeenCalled();
  });

  it('does not persist or queue a submission when storage fails', async () => {
    cloudinaryService.uploadSubmission.mockRejectedValue(new Error('Cloudinary unavailable'));

    await expect(
      service.create(
        makeFile() as never,
        { assignmentId: assignment.id, idempotencyKey: '11111111-1111-4111-8111-111111111111' },
        student
      )
    ).rejects.toThrow('Cloudinary unavailable');

    expect(submissionRepository.save).not.toHaveBeenCalled();
    expect(gradingQueue.add).not.toHaveBeenCalled();
    expect(notificationQueue.enqueueNewSubmission).not.toHaveBeenCalled();
  });

  it('cleans storage if the transactional outbox insert fails', async () => {
    outbox.execute.mockRejectedValueOnce(new Error('Database unavailable'));
    await expect(
      service.create(
        makeFile() as never,
        { assignmentId: assignment.id, idempotencyKey: '11111111-1111-4111-8111-111111111111' },
        student
      )
    ).rejects.toThrow('Database unavailable');
    expect(cloudinaryService.deleteSubmission).toHaveBeenCalledWith(
      'auragrade/submissions/generated.docx'
    );
    expect(gradingQueue.add).not.toHaveBeenCalled();
  });

  it('keeps the created submission when notification queueing fails', async () => {
    notificationQueue.enqueueNewSubmission.mockRejectedValueOnce(new Error('Queue unavailable'));

    await expect(
      service.create(
        makeFile() as never,
        { assignmentId: assignment.id, idempotencyKey: '11111111-1111-4111-8111-111111111111' },
        student
      )
    ).resolves.toEqual(expect.objectContaining({ id: 'submission-id' }));

    expect(submissionRepository.remove).not.toHaveBeenCalled();
    expect(cloudinaryService.deleteSubmission).not.toHaveBeenCalled();
  });

  it('scopes each role when listing submissions', async () => {
    submissionRepository.find.mockResolvedValue([]);

    await service.findAll(student);
    expect(submissionRepository.find).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { student: { id: student.id } } })
    );

    await service.findAll(teacher);
    expect(submissionRepository.find).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { assignment: { user: { id: teacher.id } } } })
    );

    const administrator = {
      id: 'admin-id',
      role: UserRoles.Administrador,
      institutionId: 'institution-id',
      isPlatformAdmin: false,
    } as User;
    await service.findAll(administrator);
    expect(submissionRepository.find).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { assignment: { user: { institutionId: administrator.institutionId } } },
      })
    );
  });

  it('rejects reading a submission from another teacher assignment', async () => {
    submissionRepository.findOne.mockResolvedValue({
      id: 'submission-id',
      student,
      assignment: { user: { id: 'other-teacher-id', institutionId: 'institution-id' } },
    });

    await expect(service.findOne('submission-id', teacher)).rejects.toThrow(
      'No puedes acceder a esta entrega.'
    );
  });

  it('rejects reading another student submission', async () => {
    submissionRepository.findOne.mockResolvedValue({
      id: 'submission-id',
      student: { id: 'other-student-id' },
      assignment: { user: teacher },
    });

    await expect(service.findOne('submission-id', student)).rejects.toThrow(
      'No puedes acceder a esta entrega.'
    );
  });

  it('hides draft evaluation details from the submission owner', async () => {
    submissionRepository.findOne.mockResolvedValue({
      id: 'submission-id',
      student,
      assignment: { user: teacher },
      gradingAttemptCount: 3,
      gradingFailureReason: 'El servicio de IA no pudo completar la evaluación.',
      gradingLastAttemptAt: new Date('2026-08-15T14:30:00.000Z'),
      evaluation: { id: 'evaluation-id', status: EvaluationStatus.DRAFT, totalScore: 8 },
    });

    const result = await service.findOne('submission-id', student);

    expect(result.evaluation).toBeUndefined();
    expect(result.gradingAttemptCount).toBeUndefined();
    expect(result.gradingFailureReason).toBeUndefined();
    expect(result.gradingLastAttemptAt).toBeUndefined();
  });

  it('atomically queues a retry for a failed submission owned by the teacher', async () => {
    const failedSubmission = {
      id: 'submission-id',
      fileUrl: 'https://example.com/entrega.docx',
      status: SubmissionStatus.FAILED,
      student,
      assignment: { user: teacher },
    };
    submissionRepository.findOne.mockResolvedValue(failedSubmission);

    await expect(service.retryGrading(failedSubmission.id, teacher)).resolves.toEqual(
      expect.objectContaining({ status: SubmissionStatus.PENDING })
    );
    expect(submissionRepository.update).toHaveBeenCalledWith(
      { id: failedSubmission.id, status: SubmissionStatus.FAILED },
      { status: SubmissionStatus.PENDING }
    );
    expect(gradingQueue.add).not.toHaveBeenCalled();
    expect(outbox.values).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'grading',
        aggregateId: failedSubmission.id,
        id: expect.stringMatching(/^grading-submission-id-retry-/),
      })
    );
  });

  it('rejects retrying another teacher submission', async () => {
    submissionRepository.findOne.mockResolvedValue({
      id: 'submission-id',
      fileUrl: 'https://example.com/entrega.docx',
      status: SubmissionStatus.FAILED,
      assignment: { user: { id: 'other-teacher-id' } },
    });

    await expect(service.retryGrading('submission-id', teacher)).rejects.toThrow('otro docente');
    expect(gradingQueue.add).not.toHaveBeenCalled();
  });

  it('prevents a student from retrying grading', async () => {
    await expect(service.retryGrading('submission-id', student)).rejects.toThrow(
      'Solo un docente puede reintentar'
    );
    expect(submissionRepository.findOne).not.toHaveBeenCalled();
    expect(gradingQueue.add).not.toHaveBeenCalled();
  });

  it('prevents duplicate retries with an atomic status claim', async () => {
    submissionRepository.findOne.mockResolvedValue({
      id: 'submission-id',
      fileUrl: 'https://example.com/entrega.docx',
      status: SubmissionStatus.FAILED,
      assignment: { user: teacher },
    });
    submissionRepository.update.mockResolvedValueOnce({ affected: 0 });

    await expect(service.retryGrading('submission-id', teacher)).rejects.toThrow('ya fue tomada');
    expect(gradingQueue.add).not.toHaveBeenCalled();
  });

  it('rolls back the retry transaction when its durable event cannot be saved', async () => {
    submissionRepository.findOne.mockResolvedValue({
      id: 'submission-id',
      fileUrl: 'https://example.com/entrega.docx',
      status: SubmissionStatus.FAILED,
      assignment: { user: teacher },
    });
    outbox.execute.mockRejectedValueOnce(new Error('Outbox unavailable'));

    await expect(service.retryGrading('submission-id', teacher)).rejects.toThrow(
      'Outbox unavailable'
    );
    expect(gradingQueue.add).not.toHaveBeenCalled();
  });
  it('rejects a new version after publication before accepting bytes', async () => {
    submissionRepository.exists.mockResolvedValue(true);
    const file = makeFile();
    await expect(
      service.create(
        file as never,
        { assignmentId: assignment.id, idempotencyKey: '11111111-1111-4111-8111-111111111111' },
        student
      )
    ).rejects.toThrow('ya fue calificada');
    expect(file.createReadStream).not.toHaveBeenCalled();
    expect(cloudinaryService.uploadSubmission).not.toHaveBeenCalled();
  });

  it('returns the original submission for a repeated request without uploading again', async () => {
    const original = {
      id: 'original-id',
      student,
      assignment,
      cloudinaryPublicId: 'auragrade/submissions/original.docx',
    };
    submissionRepository.findOne.mockResolvedValue(original);
    const file = makeFile();
    await expect(
      service.create(
        file as never,
        { assignmentId: assignment.id, idempotencyKey: '11111111-1111-4111-8111-111111111111' },
        student
      )
    ).resolves.toEqual(expect.objectContaining({ id: 'original-id' }));
    expect(file.createReadStream).not.toHaveBeenCalled();
    expect(cloudinaryService.uploadSubmission).not.toHaveBeenCalled();
  });

  it('rejects reuse of a submission key for another assignment', async () => {
    submissionRepository.findOne.mockResolvedValue({
      id: 'original-id',
      assignment: { id: 'another-assignment' },
    });
    await expect(
      service.create(
        makeFile() as never,
        { assignmentId: assignment.id, idempotencyKey: '11111111-1111-4111-8111-111111111111' },
        student
      )
    ).rejects.toThrow('otra tarea');
    expect(cloudinaryService.uploadSubmission).not.toHaveBeenCalled();
  });

  it('does not offer a download to another student', async () => {
    submissionRepository.findOne.mockResolvedValue({
      id: 'original-id',
      student: { id: 'another-student' },
      assignment,
      cloudinaryPublicId: 'auragrade/submissions/original.docx',
    });
    await expect(service.download('original-id', student)).rejects.toThrow('No puedes acceder');
  });

  it('rejects forged ZIP expansion sizes before uploading', async () => {
    const malformed = Buffer.from(validDocxContent);
    const directoryOffset = malformed.readUInt32LE(malformed.length - 22 + 16);
    malformed.writeUInt32LE(0, directoryOffset + 24);
    await expect(
      service.create(
        makeFile({ createReadStream: () => Readable.from(malformed) }) as never,
        { assignmentId: assignment.id, idempotencyKey: '11111111-1111-4111-8111-111111111111' },
        student
      )
    ).rejects.toThrow();
    expect(cloudinaryService.uploadSubmission).not.toHaveBeenCalled();
  });
});
