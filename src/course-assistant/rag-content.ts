import { BadRequestException } from '@nestjs/common';
export const EMBEDDING_MODEL = 'gemini-embedding-001';
export const INDEX_REVISION = 'page-1600-200-v1';
export type Chunk = { ordinal: number; page: number; text: string };
export function chunkPages(pages: { page: number; text: string }[]): Chunk[] {
  if (pages.reduce((n, p) => n + p.text.length, 0) > 500000)
    throw new BadRequestException('El documento supera el tamaño permitido.');
  const chunks: Chunk[] = [];
  for (const page of pages) {
    const text = page.text.trim();
    for (let start = 0; start < text.length; start += 1400) {
      chunks.push({
        ordinal: chunks.length,
        page: page.page,
        text: text.slice(start, start + 1600),
      });
      if (start + 1600 >= text.length) break;
    }
  }
  if (chunks.length > 512)
    throw new BadRequestException('Divide el documento antes de prepararlo.');
  return chunks;
}
export function normalizedVector(values: number[]): number[] {
  if (!Array.isArray(values) || values.length !== 768 || values.some((v) => !Number.isFinite(v)))
    throw new Error('Invalid embedding');
  const norm = Math.sqrt(values.reduce((s, v) => s + v * v, 0));
  if (!Number.isFinite(norm) || norm === 0) throw new Error('Invalid embedding norm');
  return values.map((v) => v / norm);
}
export function validateAnswer(
  value: unknown,
  ids: string[]
): { answer: string; citationIds: string[] } | null {
  if (!value || typeof value !== 'object') return null;
  const body = value as Record<string, unknown>;
  if (
    typeof body.answer !== 'string' ||
    !body.answer.trim() ||
    body.answer.length > 4000 ||
    !Array.isArray(body.citationIds) ||
    !body.citationIds.length ||
    body.citationIds.length > 6 ||
    body.citationIds.some((id) => typeof id !== 'string' || !ids.includes(id))
  )
    return null;
  return { answer: body.answer.trim(), citationIds: [...new Set(body.citationIds as string[])] };
}

/** DOCX has no stable PDF pages; cite ordinal fragments of its verified extracted text. */
export function sourceChunks(source: {
  format: string;
  pages: { page: number; text: string }[];
  extractedText?: string;
}): Chunk[] {
  return source.format === 'docx'
    ? chunkPages([{ page: 1, text: source.extractedText ?? '' }]).map((c, i) => ({
        ...c,
        page: i + 1,
      }))
    : chunkPages(source.pages);
}
