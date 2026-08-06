import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { Writable } from 'stream';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';

jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload_stream: jest.fn(),
      destroy: jest.fn(),
    },
  },
}));

describe('CloudinaryService', () => {
  const credentials: Record<string, string> = {
    CLOUDINARY_NAME: 'aura-cloud',
    CLOUDINARY_API_KEY: 'server-api-key',
    CLOUDINARY_API_SECRET: 'server-api-secret',
  };
  const configService = {
    getOrThrow: jest.fn((key: string) => credentials[key]),
  } as unknown as ConfigService;
  let service: CloudinaryService;
  let uploadedContent: Buffer;

  beforeEach(() => {
    jest.clearAllMocks();
    uploadedContent = Buffer.alloc(0);
    (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation(
      (_options, callback) =>
        new Writable({
          write(chunk, _encoding, done) {
            uploadedContent = Buffer.concat([uploadedContent, Buffer.from(chunk)]);
            done();
          },
          final(done) {
            callback(null, {
              secure_url: 'https://res.cloudinary.com/aura/raw/upload/generated.docx',
              public_id: 'auragrade/submissions/generated.docx',
            });
            done();
          },
        })
    );
    (cloudinary.uploader.destroy as jest.Mock).mockResolvedValue({ result: 'ok' });
    service = new CloudinaryService(configService);
  });

  it('configures the SDK exclusively from server-side configuration', () => {
    expect(cloudinary.config).toHaveBeenCalledWith({
      cloud_name: 'aura-cloud',
      api_key: 'server-api-key',
      api_secret: 'server-api-secret',
    });
  });

  it('uploads a submission as a raw resource with a random safe identifier', async () => {
    const content = Buffer.from('docx-content');

    const result = await service.uploadSubmission(content);

    expect(uploadedContent).toEqual(content);
    expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(
      expect.objectContaining({
        folder: 'auragrade/submissions',
        resource_type: 'raw',
        use_filename: false,
        unique_filename: false,
        overwrite: false,
        public_id: expect.stringMatching(/^[0-9a-f-]+\.docx$/),
      }),
      expect.any(Function)
    );
    expect(result).toEqual({
      secureUrl: 'https://res.cloudinary.com/aura/raw/upload/generated.docx',
      publicId: 'auragrade/submissions/generated.docx',
    });
  });

  it('rejects an incomplete response from Cloudinary', async () => {
    (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation(
      (_options, callback) =>
        new Writable({
          write(_chunk, _encoding, done) {
            done();
          },
          final(done) {
            callback(null, { public_id: 'auragrade/submissions/generated.docx' });
            done();
          },
        })
    );

    await expect(service.uploadSubmission(Buffer.from('docx'))).rejects.toThrow(
      'Cloudinary no devolvió un archivo válido.'
    );
  });

  it('propagates an upload error without returning a partial reference', async () => {
    (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation(
      (_options, callback) =>
        new Writable({
          write(_chunk, _encoding, done) {
            done();
          },
          final(done) {
            callback(new Error('Cloudinary unavailable'));
            done();
          },
        })
    );

    await expect(service.uploadSubmission(Buffer.from('docx'))).rejects.toThrow(
      'Cloudinary unavailable'
    );
  });

  it('deletes only raw resources from the submissions folder', async () => {
    await service.deleteSubmission('auragrade/submissions/generated.docx');

    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith(
      'auragrade/submissions/generated.docx',
      { resource_type: 'raw', invalidate: true }
    );
  });

  it('refuses to delete a resource outside the submissions folder', async () => {
    await expect(service.deleteSubmission('other-folder/file.docx')).rejects.toThrow(
      'no pertenece a entregas'
    );
    expect(cloudinary.uploader.destroy).not.toHaveBeenCalled();
  });
});
