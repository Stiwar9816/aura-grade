import { Module } from '@nestjs/common';
// Config
import { ConfigModule, ConfigService } from '@nestjs/config';
// Services
import { AiService } from './ai.service';
// Providers
import { OpenAiProvider, GeminiProvider } from './providers';
import { aiProviderFactory } from './ai-provider.factory';

@Module({
  providers: [
    AiService,
    ConfigService,
    ConfigModule,
    OpenAiProvider,
    GeminiProvider,
    aiProviderFactory,
  ],
  exports: [AiService],
})
export class AiModule {}
