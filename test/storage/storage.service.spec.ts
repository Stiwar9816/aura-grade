import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageService } from 'src/storage/storage.service';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(async () => 'https://ref.storage.supabase.co/storage/v1/s3/signed'),
}));

const KEY = 'submissions/3f0f8f7e-1c2b-4c2d-9a0e-0d6f7b8c9a10.docx';
const DOC_KEY = 'course-documents/3f0f8f7e-1c2b-4c2d-9a0e-0d6f7b8c9a10.pdf';

describe('StorageService', () => {
  const config = {
    getOrThrow: jest.fn(
      (key: string) =>
        ({
          STORAGE_BUCKET: 'auragrade',
          STORAGE_S3_ENDPOINT: 'https://ref.storage.supabase.co/storage/v1/s3',
          STORAGE_S3_REGION: 'us-east-1',
          STORAGE_S3_ACCESS_KEY_ID: 'id',
          STORAGE_S3_SECRET_ACCESS_KEY: 'secret',
        })[key]
    ),
  };
  let send: jest.SpyInstance;
  let service: StorageService;

  beforeEach(() => {
    jest.clearAllMocks();
    send = jest.spyOn(S3Client.prototype, 'send').mockResolvedValue({} as never);
    service = new StorageService(config as never);
  });

  it('uploads submissions as private DOCX objects under the submissions folder', async () => {
    const stored = await service.uploadSubmission(Buffer.from('docx'));

    expect(stored.key).toMatch(/^submissions\/[0-9a-f-]{36}\.docx$/);
    const command = send.mock.calls[0][0] as PutObjectCommand;
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toMatchObject({
      Bucket: 'auragrade',
      Key: stored.key,
      ContentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
  });

  it('uploads course documents with the content type of their format', async () => {
    const stored = await service.uploadCourseDocument(Buffer.from('pdf'), 'pdf');

    expect(stored.key).toMatch(/^course-documents\/[0-9a-f-]{36}\.pdf$/);
    expect((send.mock.calls[0][0] as PutObjectCommand).input.ContentType).toBe('application/pdf');
  });

  it('signs short-lived attachment downloads', async () => {
    await expect(service.submissionDownloadUrl(KEY)).resolves.toContain('storage.supabase.co');

    const [, command, options] = (getSignedUrl as jest.Mock).mock.calls[0];
    expect(command.input).toEqual({
      Bucket: 'auragrade',
      Key: KEY,
      ResponseContentDisposition: 'attachment',
    });
    expect(options).toEqual({ expiresIn: 60 });
  });

  it('rejects keys from another folder before reaching storage', async () => {
    await expect(service.submissionDownloadUrl(DOC_KEY)).rejects.toThrow(
      'El identificador del archivo no es válido.'
    );
    await expect(service.deleteCourseDocument(KEY)).rejects.toThrow(
      'El identificador del archivo no es válido.'
    );
    await expect(service.deleteSubmission('submissions/../x.docx')).rejects.toThrow();
    expect(getSignedUrl).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('deletes only validated keys', async () => {
    await service.deleteCourseDocument(DOC_KEY);

    const command = send.mock.calls[0][0] as DeleteObjectCommand;
    expect(command).toBeInstanceOf(DeleteObjectCommand);
    expect(command.input).toEqual({ Bucket: 'auragrade', Key: DOC_KEY });
  });
});
