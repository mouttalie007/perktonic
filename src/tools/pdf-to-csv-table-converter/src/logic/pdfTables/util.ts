import type { Merge, TextRun } from "./types";

/** Cluster sorted numbers: values closer than `tol` to the previous member join its cluster (mean returned). */
export function cluster(values: number[], tol: number): number[] {
  const v = [...values].sort((a, b) => a - b);
  const out: number[][] = [];
  for (const x of v) {
    const last = out.at(-1);
    if (last && x - last[last.length - 1] <= tol) last.push(x);
    else out.push([x]);
  }
  return out.map((g) => g.reduce((s, x) => s + x, 0) / g.length);
}

/** Joins the runs of one cell: line by line from the top, each line in reading order. */
export function joinRuns(runs: TextRun[]): string {
  if (!runs.length) return "";
  const sorted = [...runs].sort((a, b) => a.y - b.y);
  const lines: TextRun[][] = [];
  for (const r of sorted) {
    const line = lines.at(-1);
    if (line && Math.abs(line[0].y - r.y) <= Math.max(line[0].size, r.size) * 0.4) line.push(r);
    else lines.push([r]);
  }
  return lines
    .map((line) => {
      const rtl = line.filter((r) => r.rtl).length * 2 > line.length;
      return line
        .sort((a, b) => (rtl ? b.x0 - a.x0 : a.x0 - b.x0))
        .map((r) => r.text)
        .join(" ");
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Mirror a grid left-to-right (for right-to-left tables, so column 1 is the rightmost one). */
export function mirror(rows: string[][], merges: Merge[]): { rows: string[][]; merges: Merge[] } {
  const cols = rows[0]?.length ?? 0;
  const out = rows.map((r) => [...r].reverse());
  const m = merges.map((g) => {
    const col = cols - g.col - g.colSpan;
    // The merged text was in the old top-left cell, which is now the right end of the span.
    const r = out[g.row];
    const text = r[col + g.colSpan - 1];
    r[col + g.colSpan - 1] = "";
    r[col] = text;
    return { ...g, col };
  });
  return { rows: out, merges: m };
}

const NUMERIC = /^[-+(]?[$€£¥]?\s?\d[\d.,\s'’]*%?\)?$/;

/** Right-to-left when runs with Arabic or Hebrew letters outnumber runs with Latin letters (digits do not count). */
export function isRtl(runs: TextRun[]): boolean {
  const rtl = runs.filter((r) => r.rtl).length;
  const ltr = runs.filter((r) => !r.rtl && /[A-Za-z\u00C0-\u024F]/.test(r.text)).length;
  return rtl > 0 && rtl >= ltr;
}

/** A header row: the first row has no numbers while later rows do. Merged cells at the top add header rows. */
export function guessHeaderRows(rows: string[][], merges: Merge[]): number {
  if (rows.length < 2) return 0;
  const topMerges = merges.filter((m) => m.row === 0);
  if (topMerges.length) return Math.min(rows.length - 1, Math.max(2, ...topMerges.map((m) => m.rowSpan)));
  // A year such as 2026 is a typical column title, so it does not count as a number here.
  const numericIn = (r: string[]) => r.filter((t) => NUMERIC.test(t.trim()) && !/^(19|20)\d\d$/.test(t.trim())).length;
  const first = rows[0];
  if (first.filter((t) => t.trim()).length === 0) return 0;
  if (numericIn(first) === 0 && rows.slice(1).some((r) => numericIn(r) > 0)) return 1;
  return numericIn(first) === 0 ? 1 : 0;
}
