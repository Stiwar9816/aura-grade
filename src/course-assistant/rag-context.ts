/** Include a bounded continuation because activity headings and criteria often span fragments. */
export function expandContext<
  T extends { versionId: string; ordinal: number; page: number; text: string; similarity: number },
>(anchors: T[], neighbors: T[]): T[] {
  const result: T[] = [];
  const seen = new Set<string>();
  for (const anchor of anchors.slice(0, 3)) {
    const next = neighbors.find(
      (h) =>
        h.versionId === anchor.versionId &&
        h.ordinal === anchor.ordinal + 1 &&
        h.page >= anchor.page &&
        h.page <= anchor.page + 1
    );
    for (const hit of next ? [anchor, { ...next, similarity: anchor.similarity }] : [anchor]) {
      const key = `${hit.versionId}:${hit.ordinal}`;
      if (!seen.has(key)) {
        result.push(hit);
        seen.add(key);
      }
    }
  }
  return result;
}
