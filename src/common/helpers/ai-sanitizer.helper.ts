export class AiSanitizer {
  private static readonly BLACKLIST = [
    /ignore all previous instructions/gi,
    /ignora todas las instrucciones anteriores/gi,
    /forget all previous instructions/gi,
    /olvida todas las instrucciones anteriores/gi,
    /system prompt/gi,
    /prompt del sistema/gi,
    /instrucciones del sistema/gi,
    /you are now/gi,
    /ahora eres/gi,
    /acting as/gi,
    /actúa como/gi,
    /override/gi,
    /anular/gi,
    /omit/gi,
    /omitir/gi,
    /instruction injection/gi,
    /inyección de instrucciones/gi,
    /---/g,
    /###/g,
    /asistente de ia/gi, // Intentos de re-definir tu rol
    /developer mode/gi, // Intentos de activar "modos" inexistentes
    /dan mode/gi, // Ataques clásicos de "Do Anything Now"
    /olvida lo que sabes/gi, // Variación de reset
    /nueva regla:/gi, // Intentos de inyectar lógica
    /escribe un poema/gi, // Desvío de atención (Spam)
    /ignore preceding/gi, // Variaciones técnicas
    /terminal/gi,
    /system/gi, // Palabras que evocan control de bajo nivel
    /haz de cuenta que/gi, // Inicio de juego de rol
    /responde solo con un 5/gi, // Directriz de resultado
    /calificación máxima/gi, // Directriz de resultado
  ];

  /**
   * Limpia el texto de posibles intentos de prompt injection y
   * normaliza el contenido para la IA.
   */
  static clean(text: string, maxLength: number = 15000): string {
    if (!text) return '';

    let sanitized = text;

    // 1. Limpieza básica de caracteres nulos o raros
    sanitized = sanitized.replace(/\0/g, '');

    // 2. Eliminar patrones conocidos de inyección
    for (const pattern of this.BLACKLIST) {
      sanitized = sanitized.replace(pattern, '[REMOVED]');
    }

    // 3. Normalizar espacios en blanco
    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    // 4. Truncar longitud para evitar ataques de denegación de servicio por tokens
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength) + '... [TRUNCATED]';
    }

    return sanitized;
  }
}
