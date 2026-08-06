import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';

const SUBMISSIONS_FOLDER = 'auragrade/submissions';

export type StoredSubmissionFile = {
  secureUrl: string;
  publicId: string;
};

@Injectable()
export class CloudinaryService {
  constructor(private readonly configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.getOrThrow<string>('CLOUDINARY_NAME'),
      api_key: this.configService.getOrThrow<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.getOrThrow<string>('CLOUDINARY_API_SECRET'),
    });
  }

  async uploadSubmission(content: Buffer): Promise<StoredSubmissionFile> {
    const publicId = `${randomUUID()}.docx`;
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: SUBMISSIONS_FOLDER,
          resource_type: 'raw',
          public_id: publicId,
          use_filename: false,
          unique_filename: false,
          overwrite: false,
        },
        (error, result) => {
          if (error || !result?.secure_url || !result.public_id)
            return reject(error ?? new Error('Cloudinary no devolvió un archivo válido.'));
          resolve({ secureUrl: result.secure_url, publicId: result.public_id });
        }
      );
      uploadStream.on('error', reject);
      Readable.from(content).pipe(uploadStream);
    });
  }

  async deleteSubmission(publicId: string): Promise<void> {
    if (!publicId.startsWith(`${SUBMISSIONS_FOLDER}/`))
      throw new Error('El identificador de Cloudinary no pertenece a entregas.');
    await cloudinary.uploader.destroy(publicId, {
      resource_type: 'raw',
      invalidate: true,
    });
  }
}
