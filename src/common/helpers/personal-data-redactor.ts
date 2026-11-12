const EMAIL = /[\p{L}\d._%+-]+@[\p{L}\d.-]+\.[\p{L}]{2,}/gu;
// Long digit runs, dotted identity numbers (1.234.567.890) and spaced phones (300 123 4567).
const NUMBER = /(?<![\d.,])(?:\+?\d{7,}|\d{1,3}(?:\.\d{3}){2,3}|\d{3}[ -]\d{3}[ -]\d{4})(?![\d])/g;
const PARTICLES = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'da', 'do', 'dos', 'san']);
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Best-effort removal of personal data from free text before it leaves the platform.
 * It catches emails, phone/identity numbers and the names passed in `knownNames`
 * (the people on the record). It cannot recognise names of third parties.
 */
export function redactPersonalData(text: unknown, knownNames: unknown[] = []): string {
  if (typeof text !== 'string' || !text) return '';
  let result = text.replace(EMAIL, '[CORREO]').replace(NUMBER, '[NUMERO]');
  const tokens = new Set<string>();
  for (const name of knownNames) {
    if (typeof name !== 'string') continue;
    for (const token of name.split(/\s+/)) {
      const clean = token.trim();
      if (clean.length >= 3 && !PARTICLES.has(clean.toLocaleLowerCase('es'))) tokens.add(clean);
    }
  }
  for (const token of tokens)
    result = result.replace(
      new RegExp(`(?<![\\p{L}])${escape(token)}(?![\\p{L}])`, 'giu'),
      '[NOMBRE]'
    );
  return result;
}
