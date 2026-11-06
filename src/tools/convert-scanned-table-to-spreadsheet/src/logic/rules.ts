import type { Gray } from "./preprocess";

/** Ruled lines found by projecting dark pixels: a pixel row (column) with a long dark run is a rule. */
export function findRuleLines(g: Gray, minFraction = 0.5): { h: number[]; v: number[] } {
  const longestRun = (get: (i: number) => number, n: number) => {
    let best = 0;
    let cur = 0;
    for (let i = 0; i < n; i++) {
      // Allow one-pixel gaps (scan noise).
      if (get(i) < 128 || (cur > 0 && i + 1 < n && get(i + 1) < 128)) best = Math.max(best, ++cur);
      else cur = 0;
    }
    return best;
  };
  const rows: number[] = [];
  for (let y = 0; y < g.height; y++) if (longestRun((x) => g.data[y * g.width + x], g.width) >= g.width * minFraction) rows.push(y);
  const cols: number[] = [];
  for (let x = 0; x < g.width; x++) if (longestRun((y) => g.data[y * g.width + x], g.height) >= g.height * minFraction * 0.6) cols.push(x);
  const group = (v: number[]) => {
    const out: number[][] = [];
    for (const p of v) {
      const last = out.at(-1);
      if (last && p - last[last.length - 1] <= 2) last.push(p);
      else out.push([p]);
    }
    return out.map((g2) => (g2[0] + g2[g2.length - 1]) / 2);
  };
  return { h: group(rows), v: group(cols) };
}
