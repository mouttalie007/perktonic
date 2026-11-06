/** "1-3, 5" → [1, 2, 3, 5] within 1..total. Empty text means every page. */
export function parsePageRange(text: string, total: number): { ok: true; pages: number[] } | { ok: false; error: string } {
  const t = text.trim();
  if (!t) return { ok: true, pages: Array.from({ length: total }, (_, i) => i + 1) };
  const set = new Set<number>();
  for (const part of t.split(/[,;]\s*/)) {
    const m = /^(\d+)\s*(?:[-–]\s*(\d+))?$/.exec(part.trim());
    if (!m) return { ok: false, error: `"${part.trim()}" is not a page or a range. Write pages like "1-3, 5".` };
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    if (a < 1 || b < a) return { ok: false, error: `"${part.trim()}" is not a valid range.` };
    if (a > total) return { ok: false, error: `The PDF has ${total} page${total === 1 ? "" : "s"}; page ${a} does not exist.` };
    for (let p = a; p <= Math.min(b, total); p++) set.add(p);
  }
  return { ok: true, pages: [...set].sort((x, y) => x - y) };
}
