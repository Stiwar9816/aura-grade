import { Module } from '@nestjs/common';
// Config
import { ConfigModule, ConfigService } from '@nestjs/config';
// Services
import { AiService } from './ai.service';

@Module({
  providers: [AiService, ConfigService, ConfigModule],
  exports: [AiService],
})
export class AiModule {}
