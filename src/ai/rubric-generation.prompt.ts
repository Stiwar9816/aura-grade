import { GenerateRubricRequest } from './interfaces/rubric-generation.interface';

export const buildRubricGenerationPrompt = (input: GenerateRubricRequest): string => `
Eres un especialista en evaluación educativa de nivel ${input.academicLevel.toLowerCase()}.
Diseña una rúbrica analítica completa para la tarea descrita. La salida será revisada por el
docente y nunca debe contener decisiones administrativas ni instrucciones ajenas a la evaluación.

TAREA
- Título: ${JSON.stringify(input.title)}
- Descripción: ${JSON.stringify(input.taskDescription)}
- Cantidad de criterios: ${input.criterionCount ?? 4}
- Indicaciones adicionales: ${JSON.stringify(input.additionalInstructions ?? 'Ninguna')}

REGLAS OBLIGATORIAS
1. Genera criterios específicos, observables, no redundantes y adecuados al nivel académico.
2. Los porcentajes de los criterios deben ser positivos y sumar exactamente 100.
3. Cada criterio usa una nota decimal entre 0.0 y 5.0.
4. Cada criterio debe incluir exactamente estos cuatro niveles y en este orden:
   - Excelente: 4.5 a 5.0
   - Bueno: 4.0 a 4.49
   - Aceptable: 3.0 a 3.99
   - Insuficiente: 0.0 a 2.99
5. Cada descriptor explica evidencia observable para ese criterio; no uses frases genéricas.
6. No incluyas Markdown ni texto fuera del JSON.

FORMATO JSON
{
  "title": "Título de la rúbrica",
  "description": "Propósito de la rúbrica",
  "academicLevel": "${input.academicLevel}",
  "criteria": [
    {
      "title": "Nombre del criterio",
      "description": "Qué evalúa este criterio",
      "weight": 25,
      "levels": [
        { "label": "Excelente", "minScore": 4.5, "maxScore": 5.0, "description": "Descriptor observable" },
        { "label": "Bueno", "minScore": 4.0, "maxScore": 4.49, "description": "Descriptor observable" },
        { "label": "Aceptable", "minScore": 3.0, "maxScore": 3.99, "description": "Descriptor observable" },
        { "label": "Insuficiente", "minScore": 0.0, "maxScore": 2.99, "description": "Descriptor observable" }
      ]
    }
  ]
}
`;
