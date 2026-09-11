/** Page numbers to render, with "…" gaps — e.g. [1, "…", 4, 5, 6, "…", 12]. */
export function paginationRange(
  current: number,
  total: number,
  delta = 1,
): (number | "…")[] {
  if (total <= 1) return [1];
  const left = Math.max(2, current - delta);
  const right = Math.min(total - 1, current + delta);
  const range: (number | "…")[] = [1];
  if (left > 2) range.push("…");
  for (let i = left; i <= right; i++) range.push(i);
  if (right < total - 1) range.push("…");
  range.push(total);
  return range;
}
