import { Query, Resolver } from '@nestjs/graphql';
// Services
import { CloudinaryService } from './cloudinary.service';
// Types
import { CloudinarySignature } from './types';

@Resolver()
export class CloudinaryResolver {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

  @Query(() => CloudinarySignature, {
    name: 'getCloudinarySignature',
    description:
      'Generates the necessary signature to upload files directly to Cloudinary from the frontend',
  })
  getSignature() {
    return this.cloudinaryService.getUploadSignature();
  }
}
