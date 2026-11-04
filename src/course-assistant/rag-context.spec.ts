import { expandContext } from './rag-context';
it('keeps the continuation of a matching activity even when its heading is in the previous fragment', () => {
  const anchors = [
    { versionId: 'v', ordinal: 3, page: 18, text: 'ACTIVIDAD 3', similarity: 0.8 },
    { versionId: 's', ordinal: 1, page: 2, text: 'Cronograma', similarity: 0.7 },
  ];
  const next = [
    { versionId: 'v', ordinal: 4, page: 18, text: 'Criterios de evaluación', similarity: 0.1 },
    { versionId: 's', ordinal: 2, page: 9, text: 'Unrelated', similarity: 0.2 },
  ];
  const context = expandContext(anchors, next);
  expect(context.map((x) => x.text)).toEqual([
    'ACTIVIDAD 3',
    'Criterios de evaluación',
    'Cronograma',
  ]);
  expect(context[1].similarity).toBe(0.8);
});
it('never adds another version or duplicates overlapping anchors', () => {
  const a = { versionId: 'v', ordinal: 1, page: 1, text: 'A', similarity: 0.8 };
  const b = { ...a, ordinal: 2, text: 'B' };
  const context = expandContext([a, b], [b, { ...b, versionId: 'other', text: 'private' }]);
  expect(context.map((x) => x.text)).toEqual(['A', 'B']);
});
