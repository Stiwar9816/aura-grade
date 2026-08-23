// Nest
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// OpenAI
import { OpenAI } from 'openai';
// Interfaces
import { IAiProvider } from '../interfaces/ai-provider.interface';
import { GeneratedRubric, GenerateRubricRequest } from '../interfaces/rubric-generation.interface';
import { buildRubricGenerationPrompt } from '../rubric-generation.prompt';

@Injectable()
export class OpenAiProvider implements IAiProvider {
  readonly modelName = 'gpt-4o';
  private openai: OpenAI;
  private readonly logger = new Logger('OpenAiProvider');

  constructor(private config: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.config.get('OPENAI_API_KEY'),
    });
  }

  async evaluateSubmission(extractedText: string, rubric: any, assignmentTitle: string) {
    try {
      const prompt = `
        Actúa como un evaluador académico de nivel universitario con 20 años de experiencia. Tu objetivo es proporcionar una calificación justa, rigurosa y constructiva basada ESTRICTAMENTE en la rúbrica proporcionada.

        CONTEXTO DE LA EVALUACIÓN
        - **Tarea:** "${assignmentTitle}"
        - **Rúbrica de Calificación:** ${JSON.stringify(rubric)}

        ### CONTENIDO DEL ESTUDIANTE A EVALUAR
        ---
        ${extractedText}
        ---

        ### REGLAS CRÍTICAS DE CALIFICACIÓN
        1. **Fidelidad a la Rúbrica:** No inventes criterios. Cada criterio se califica de 0.0 a 5.0.
        2. **Ponderación:** El "totalScore" debe ser la suma de score * weight / 100 para todos los criterios y quedar entre 0.0 y 5.0.
        3. **Calidad del Feedback:** - En "observations", explica QUÉ falta para llegar al siguiente nivel de la rúbrica.
        - En "generalFeedback", destaca una fortaleza y una oportunidad de mejora clave. Usa un tono profesional pero alentador.
        4. **Detección de Irrelevancia:** Si el texto no corresponde a la tarea o es spam, asigna 0 o el puntaje mínimo de la rúbrica en todos los campos y explica la razón.

        ### FORMATO DE SALIDA (JSON ÚNICAMENTE)
        Responde exclusivamente con un objeto JSON siguiendo esta estructura. No incluyas texto introductorio ni explicaciones fuera del JSON.

        {
          "totalScore": 0.0,
          "generalFeedback": "Texto combinando fortalezas y áreas de mejora...",
          "detailedFeedback": [
            {
              "criterion": "Nombre exacto del criterio",
              "score": 0.0,
              "weight": 0.0,
              "weightedContribution": 0.0,
              "observations": "Explicación detallada de la puntuación basada en los niveles de la rúbrica."
            }
          ]
        }
      `;

      const response = await this.openai.chat.completions.create({
        model: this.modelName,
        messages: [{ role: 'system', content: prompt }],
        response_format: { type: 'json_object' }, // Fuerza la salida en JSON
        temperature: 0.2, // Baja temperatura para mayor consistencia
      });

      const cleanContent = response.choices[0].message.content.replace(/```json|```/g, '').trim();
      const evaluationResult = JSON.parse(cleanContent);

      return evaluationResult;
    } catch (error) {
      this.logger.error(`Error en OpenAI Provider: ${error.message}`);
      throw new InternalServerErrorException('La IA no pudo procesar la evaluación');
    }
  }

  async generateRubric(input: GenerateRubricRequest): Promise<GeneratedRubric> {
    try {
      const response = await this.openai.chat.completions.create({
        model: this.modelName,
        messages: [{ role: 'system', content: buildRubricGenerationPrompt(input) }],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      });
      const content = response.choices[0]?.message?.content?.replace(/```json|```/g, '').trim();
      if (!content) throw new Error('El proveedor devolvió una respuesta vacía.');
      return JSON.parse(content) as GeneratedRubric;
    } catch (error) {
      this.logger.error(
        `Error generando rúbrica con OpenAI: ${error instanceof Error ? error.message : 'error desconocido'}`
      );
      throw new InternalServerErrorException('La IA no pudo generar la rúbrica con OpenAI');
    }
  }
}
