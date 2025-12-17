import { Injectable } from '@nestjs/common';
// Services
import { ConfigService } from '@nestjs/config';
// Cloudinary
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  constructor(private configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get('CLOUDINARY_NAME'),
      api_key: this.configService.get('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get('CLOUDINARY_API_SECRET'),
    });
  }

  getUploadSignature() {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const folder = 'auragrade_submissions';

    const signature = cloudinary.utils.api_sign_request(
      { timestamp, folder },
      this.configService.get('CLOUDINARY_API_SECRET')
    );

    return {
      signature,
      timestamp,
      folder,
      cloudName: this.configService.get('CLOUDINARY_NAME'),
      apiKey: this.configService.get('CLOUDINARY_API_KEY'),
    };
  }
}
