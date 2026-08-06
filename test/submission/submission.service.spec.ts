import { SubmissionService } from 'src/submission/submission.service';
import { UserRoles } from 'src/auth/enums';
import { EvaluationStatus, SubmissionStatus } from 'src/enums';
import type { User } from 'src/user/entities/user.entity';
import { Readable } from 'stream';

describe('SubmissionService', () => {
  const submissionRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };
  const assignmentRepository = { findOne: jest.fn() };
  const gradingQueue = { add: jest.fn() };
  const cloudinaryService = {
    uploadSubmission: jest.fn(),
    deleteSubmission: jest.fn(),
  };
  const notificationsService = { sendNewSubmissionEmail: jest.fn() };
  const service = new SubmissionService(
    submissionRepository as never,
    assignmentRepository as never,
    gradingQueue as never,
    cloudinaryService as never,
    notificationsService as never
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
  const makeCentralDirectoryEntry = (name: string) => {
    const nameBuffer = Buffer.from(name);
    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(0, 8);
    header.writeUInt16LE(0, 10);
    header.writeUInt32LE(1, 24);
    header.writeUInt16LE(nameBuffer.length, 28);
    return Buffer.concat([header, nameBuffer]);
  };
  const makeDocxContent = () => {
    const localHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
    const centralDirectory = Buffer.concat([
      makeCentralDirectoryEntry('[Content_Types].xml'),
      makeCentralDirectoryEntry('word/document.xml'),
    ]);
    const endOfCentralDirectory = Buffer.alloc(22);
    endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
    endOfCentralDirectory.writeUInt16LE(2, 8);
    endOfCentralDirectory.writeUInt16LE(2, 10);
    endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
    endOfCentralDirectory.writeUInt32LE(localHeader.length, 16);
    return Buffer.concat([localHeader, centralDirectory, endOfCentralDirectory]);
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

  beforeEach(() => {
    jest.clearAllMocks();
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
  });

  it('creates a submission with the authenticated student identity', async () => {
    const result = await service.create(
      makeFile() as never,
      { assignmentId: assignment.id },
      student
    );

    expect(submissionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        assignment: { id: assignment.id },
        student: { id: student.id },
        status: SubmissionStatus.PENDING,
      })
    );
    expect(gradingQueue.add).toHaveBeenCalledWith(
      'grade-submission',
      { id: 'submission-id', url: 'https://example.com/entrega.docx' },
      expect.objectContaining({ jobId: 'submission-id', attempts: 3 })
    );
    expect(notificationsService.sendNewSubmissionEmail).toHaveBeenCalledWith(
      teacher,
      student,
      assignment
    );
    expect(cloudinaryService.uploadSubmission).toHaveBeenCalledWith(validDocxContent);
    expect(result.id).toBe('submission-id');
  });

  it('rejects a submission from a user who is not a student', async () => {
    await expect(
      service.create(makeFile() as never, { assignmentId: 'assignment-id' }, teacher)
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
      service.create(makeFile() as never, { assignmentId: 'assignment-id' }, student)
    ).rejects.toThrow('No estás matriculado en el curso de esta tarea.');
    expect(cloudinaryService.uploadSubmission).not.toHaveBeenCalled();
  });

  it('rejects a renamed file whose content is not a DOCX', async () => {
    await expect(
      service.create(
        makeFile({ createReadStream: () => Readable.from(Buffer.from('not-a-docx')) }) as never,
        { assignmentId: assignment.id },
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
        { assignmentId: assignment.id },
        student
      )
    ).rejects.toThrow('supera el límite de 15 MB');
    expect(cloudinaryService.uploadSubmission).not.toHaveBeenCalled();
  });

  it('does not persist or queue a submission when storage fails', async () => {
    cloudinaryService.uploadSubmission.mockRejectedValue(new Error('Cloudinary unavailable'));

    await expect(
      service.create(makeFile() as never, { assignmentId: assignment.id }, student)
    ).rejects.toThrow('Cloudinary unavailable');

    expect(submissionRepository.save).not.toHaveBeenCalled();
    expect(gradingQueue.add).not.toHaveBeenCalled();
    expect(notificationsService.sendNewSubmissionEmail).not.toHaveBeenCalled();
  });

  it('cleans Cloudinary and the database when queueing fails', async () => {
    gradingQueue.add.mockRejectedValue(new Error('Redis unavailable'));

    await expect(
      service.create(makeFile() as never, { assignmentId: assignment.id }, student)
    ).rejects.toThrow('Redis unavailable');

    expect(cloudinaryService.deleteSubmission).toHaveBeenCalledWith(
      'auragrade/submissions/generated.docx'
    );
    expect(submissionRepository.remove).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'submission-id' })
    );
    expect(notificationsService.sendNewSubmissionEmail).not.toHaveBeenCalled();
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
      evaluation: { id: 'evaluation-id', status: EvaluationStatus.DRAFT, totalScore: 8 },
    });

    const result = await service.findOne('submission-id', student);

    expect(result.evaluation).toBeUndefined();
  });
});
