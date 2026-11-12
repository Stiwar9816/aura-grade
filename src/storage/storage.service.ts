import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

export type DocumentFormat = 'pdf' | 'docx';

export type StoredFile = { key: string };

const CONTENT_TYPES: Record<DocumentFormat, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};
const DOWNLOAD_URL_TTL_SECONDS = 60;
const SUBMISSION_KEY = /^submissions\/[0-9a-f-]{36}\.docx$/;
const COURSE_DOCUMENT_KEY = /^course-documents\/[0-9a-f-]{36}\.(pdf|docx)$/;

/**
 * Private object storage (Supabase Storage through its S3-compatible API). The S3 access keys
 * only reach Storage, never the database. Keys are validated per folder before any operation so
 * a stored identifier from one domain cannot be used to read or delete files from another.
 */
@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    this.bucket = config.getOrThrow<string>('STORAGE_BUCKET');
    this.client = new S3Client({
      endpoint: config.getOrThrow<string>('STORAGE_S3_ENDPOINT'),
      region: config.getOrThrow<string>('STORAGE_S3_REGION'),
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.getOrThrow<string>('STORAGE_S3_ACCESS_KEY_ID'),
        secretAccessKey: config.getOrThrow<string>('STORAGE_S3_SECRET_ACCESS_KEY'),
      },
      // S3-compatible providers may reject the SDK's default extra checksums.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  async uploadSubmission(content: Buffer): Promise<StoredFile> {
    return this.upload('submissions', content, 'docx');
  }

  async uploadCourseDocument(content: Buffer, format: DocumentFormat): Promise<StoredFile> {
    if (!(format in CONTENT_TYPES)) throw new Error('Formato de documento inválido.');
    return this.upload('course-documents', content, format);
  }

  async submissionDownloadUrl(key: string): Promise<string> {
    return this.signedDownloadUrl(this.assertKey(key, SUBMISSION_KEY));
  }

  async courseDocumentDownloadUrl(key: string): Promise<string> {
    return this.signedDownloadUrl(this.assertKey(key, COURSE_DOCUMENT_KEY));
  }

  async deleteSubmission(key: string): Promise<void> {
    await this.delete(this.assertKey(key, SUBMISSION_KEY));
  }

  async deleteCourseDocument(key: string): Promise<void> {
    await this.delete(this.assertKey(key, COURSE_DOCUMENT_KEY));
  }

  private async upload(folder: string, content: Buffer, format: DocumentFormat) {
    const key = `${folder}/${randomUUID()}.${format}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: content,
        ContentType: CONTENT_TYPES[format],
      })
    );
    return { key };
  }

  private signedDownloadUrl(key: string): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: 'attachment',
      }),
      { expiresIn: DOWNLOAD_URL_TTL_SECONDS }
    );
  }

  private async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  private assertKey(key: string, pattern: RegExp): string {
    if (!pattern.test(key)) throw new Error('El identificador del archivo no es válido.');
    return key;
  }
}
