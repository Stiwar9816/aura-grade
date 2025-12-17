import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAI } from 'openai';

@Injectable()
export class AiService {
  private openai: OpenAI;
  private readonly logger = new Logger('AiService');

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
        1. **Fidelidad a la Rúbrica:** No inventes criterios. Si la rúbrica dice que el máximo es 5.0, no califiques sobre 10.
        2. **Consistencia:** El "totalScore" debe ser la suma exacta de los puntajes en "detailedFeedback".
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
              "observations": "Explicación detallada de la puntuación basada en los niveles de la rúbrica."
            }
          ]
        }
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-5.2', // O 'gpt-4-turbo'
        messages: [{ role: 'system', content: prompt }],
        response_format: { type: 'json_object' }, // Fuerza la salida en JSON
        temperature: 0.2, // Baja temperatura para mayor consistencia
      });

      const cleanContent = response.choices[0].message.content.replace(/```json|```/g, '').trim();
      const evaluationResult = JSON.parse(cleanContent);

      return evaluationResult;
    } catch (error) {
      this.logger.error(`Error en IA Service: ${error.message}`);
      throw new InternalServerErrorException('La IA no pudo procesar la evaluación');
    }
  }
}
