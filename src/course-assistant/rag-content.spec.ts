import { chunkPages, normalizedVector, validateAnswer } from './rag-content';

describe('RAG content boundaries', () => {
  it('keeps page provenance and bounded overlapping fragments', () => {
    const chunks = chunkPages([
      { page: 4, text: 'x'.repeat(3500) },
      { page: 7, text: 'Fin' },
    ]);
    expect(chunks.map((c) => c.page)).toEqual([4, 4, 4, 7]);
    expect(chunks.every((c) => c.text.length <= 1600)).toBe(true);
    expect(chunks[2].text.length).toBe(700);
    expect(chunks.map((c) => c.ordinal)).toEqual([0, 1, 2, 3]);
  });
  it('never indexes empty pages or silently truncates oversized documents', () => {
    expect(chunkPages([{ page: 1, text: '  ' }])).toEqual([]);
    expect(() => chunkPages([{ page: 1, text: 'x'.repeat(800000) }])).toThrow();
  });
  it('normalizes only finite nonzero vectors of the expected dimension', () => {
    const v = normalizedVector(Array(768).fill(1));
    expect(v.reduce((s, x) => s + x * x, 0)).toBeCloseTo(1);
    for (const bad of [[1], Array(768).fill(0), Array(768).fill(NaN)])
      expect(() => normalizedVector(bad)).toThrow();
  });
  it('rejects fabricated citations, missing citations and excessive responses', () => {
    expect(validateAnswer({ answer: 'Texto', citationIds: ['s1'] }, ['s1'])).toEqual({
      answer: 'Texto',
      citationIds: ['s1'],
    });
    for (const body of [
      { answer: 'x', citationIds: ['inventada'] },
      { answer: 'x', citationIds: [] },
      { answer: 'x'.repeat(4001), citationIds: ['s1'] },
    ])
      expect(validateAnswer(body, ['s1'])).toBeNull();
    expect(validateAnswer({ answer: 'x', citationIds: ['s1', 's1'] }, ['s1'])?.citationIds).toEqual(
      ['s1']
    );
  });
});
