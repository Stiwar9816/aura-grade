import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { IAiProvider } from '../interfaces/ai-provider.interface';

@Injectable()
export class GeminiProvider implements IAiProvider {
  private genAI: GoogleGenAI;
  private readonly logger = new Logger('GeminiProvider');

  constructor(private config: ConfigService) {
    this.genAI = new GoogleGenAI(this.config.get('GEMINI_API_KEY'));
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

      const response = await this.genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
        },
      });

      const text = response.text;
      const cleanContent = text.replace(/```json|```/g, '').trim();
      const evaluationResult = JSON.parse(cleanContent);

      return evaluationResult;
    } catch (error) {
      this.logger.error(`Error en Gemini Provider: ${error.message}`);
      throw new InternalServerErrorException('La IA no pudo procesar la evaluación con Gemini');
    }
  }
}
