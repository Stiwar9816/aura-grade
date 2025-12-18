import { UseGuards } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';
// Services
import { CloudinaryService } from './cloudinary.service';
// Types
import { CloudinarySignature } from './types';
// Guards
import { JwtAuthGuard } from 'src/auth/guards';
// Decorators
import { CurrentUser } from 'src/auth/decorators';
// Enums
import { UserRoles } from 'src/auth/enums';
// Entities
import { User } from 'src/user/entities/user.entity';

@Resolver()
export class CloudinaryResolver {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

  @Query(() => CloudinarySignature, {
    name: 'getCloudinarySignature',
    description:
      'Generates the necessary signature to upload files directly to Cloudinary from the frontend',
  })
  @UseGuards(JwtAuthGuard)
  getSignature(
    @CurrentUser([UserRoles.Administrador, UserRoles.Docente, UserRoles.Estudiante]) user: User
  ) {
    return this.cloudinaryService.getUploadSignature();
  }
}
