import { Module } from '@nestjs/common';
// Config
import { ConfigService } from '@nestjs/config';
// Services
import { AiService } from './ai.service';

@Module({
  providers: [AiService, ConfigService],
  exports: [AiService],
})
export class AiModule {}
