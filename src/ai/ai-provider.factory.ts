import { FactoryProvider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAiProvider, GeminiProvider } from './providers';

export const AI_PROVIDER_TOKEN = 'AI_PROVIDER_TOKEN';

export const aiProviderFactory: FactoryProvider = {
  provide: AI_PROVIDER_TOKEN,
  useFactory: (
    configService: ConfigService,
    openAiProvider: OpenAiProvider,
    geminiProvider: GeminiProvider
  ) => {
    const aiProvider = configService.get('AI_PROVIDER');

    if (aiProvider === 'gemini') return geminiProvider;

    // Default to OpenAI
    return openAiProvider;
  },
  inject: [ConfigService, OpenAiProvider, GeminiProvider],
};
