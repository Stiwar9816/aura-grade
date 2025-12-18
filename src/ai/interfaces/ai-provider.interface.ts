export interface IAiProvider {
  evaluateSubmission(extractedText: string, rubric: any, assignmentTitle: string): Promise<any>;
}
