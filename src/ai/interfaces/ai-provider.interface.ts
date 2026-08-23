import { GeneratedRubric, GenerateRubricRequest } from './rubric-generation.interface';

export interface IAiProvider {
  evaluateSubmission(extractedText: string, rubric: any, assignmentTitle: string): Promise<any>;
  generateRubric(input: GenerateRubricRequest): Promise<GeneratedRubric>;
  readonly modelName: string;
}
