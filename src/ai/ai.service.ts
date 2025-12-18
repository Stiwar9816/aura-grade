import { Inject, Injectable } from '@nestjs/common';
import { IAiProvider } from './interfaces/ai-provider.interface';
import { AI_PROVIDER_TOKEN } from './ai-provider.factory';

@Injectable()
export class AiService {
  constructor(
    @Inject(AI_PROVIDER_TOKEN)
    private readonly aiProvider: IAiProvider
  ) {}

  async evaluateSubmission(extractedText: string, rubric: any, assignmentTitle: string) {
    return this.aiProvider.evaluateSubmission(extractedText, rubric, assignmentTitle);
  }
}
