import { BadRequestException } from '@nestjs/common';
export class AiSanitizer {
  private static readonly PROMPT_OVERRIDE_PATTERNS = [
    /ignore all previous instructions/gi,
    /ignora todas las instrucciones anteriores/gi,
    /forget all previous instructions/gi,
    /olvida todas las instrucciones anteriores/gi,
    /override (the )?(system|developer) (prompt|instructions?)/gi,
    /anula (el )?(prompt|instrucciones) (del sistema|anteriores)/gi,
  ];
  static clean(text: string, maxLength = 100000): string {
    const sanitized = (text || '').replace(/\0/g, '').trim();
    if (sanitized.length > maxLength)
      throw new BadRequestException(
        `El documento supera ${maxLength.toLocaleString('es-CO')} caracteres de texto. Reduce su extensión; no se evaluará parcialmente.`
      );
    return sanitized;
  }

  static cleanPromptInput(text: string, maxLength: number): string {
    if (!text) return '';
    let sanitized = text.replace(/\0/g, '');
    for (const pattern of this.PROMPT_OVERRIDE_PATTERNS)
      sanitized = sanitized.replace(pattern, '[REMOVED]');
    sanitized = Array.from(sanitized)
      .filter((character) => {
        const code = character.charCodeAt(0);
        return code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127);
      })
      .join('');
    return sanitized.trim().slice(0, maxLength);
  }
}
