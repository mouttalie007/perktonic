/**
 * Mixes a newest-first list so that the categories alternate (A, B, C, A, B, C…),
 * which keeps the colours of the covers varied on the blog index.
 * Inside each category the order stays newest first; categories with fewer
 * articles simply drop out of the rotation when they run out.
 */
export function interleaveByCategory<T extends { category: { slug: string } | null }>(
  items: T[],
  categoryOrder: string[] = [],
): T[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = item.category?.slug ?? "_none";
    const list = groups.get(key);
    if (list) list.push(item);
    else groups.set(key, [item]);
  }
  // Rotate in the configured category order, then any category not in that list.
  const keys = [
    ...categoryOrder.filter((k) => groups.has(k)),
    ...[...groups.keys()].filter((k) => !categoryOrder.includes(k)),
  ];
  const out: T[] = [];
  for (let round = 0; out.length < items.length; round++) {
    for (const key of keys) {
      const item = groups.get(key)![round];
      if (item) out.push(item);
    }
  }
  return out;
}
