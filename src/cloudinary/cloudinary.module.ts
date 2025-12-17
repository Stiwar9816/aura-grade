import { Module } from '@nestjs/common';
// Config
import { ConfigService } from '@nestjs/config';
// Services
import { CloudinaryService } from './cloudinary.service';

@Module({
  providers: [CloudinaryService, ConfigService],
  exports: [CloudinaryService],
})
export class CloudinaryModule {}
