import type { RawTable } from "./ruled";
import type { Merge, TextRun } from "./types";
import { isRtl, joinRuns } from "./util";

interface Chunk {
  runs: TextRun[];
  x0: number;
  x1: number;
}
interface Line {
  y: number;
  size: number;
  chunks: Chunk[];
}

/** Runs on one baseline form a line; runs closer than ~0.8 em form one chunk (one cell candidate). */
export function linesOf(runs: TextRun[]): Line[] {
  const sorted = [...runs].sort((a, b) => a.y - b.y || a.x0 - b.x0);
  const lines: { y: number; size: number; runs: TextRun[] }[] = [];
  for (const r of sorted) {
    const line = lines.at(-1);
    if (line && Math.abs(line.y - r.y) <= Math.max(line.size, r.size) * 0.35) {
      line.runs.push(r);
      line.size = Math.max(line.size, r.size);
    } else lines.push({ y: r.y, size: r.size, runs: [r] });
  }
  return lines.map((l) => {
    const rs = [...l.runs].sort((a, b) => a.x0 - b.x0);
    const chunks: Chunk[] = [];
    for (const r of rs) {
      const c = chunks.at(-1);
      if (c && r.x0 - c.x1 < l.size * 0.8) {
        c.runs.push(r);
        c.x1 = Math.max(c.x1, r.x1);
      } else chunks.push({ runs: [r], x0: r.x0, x1: r.x1 });
    }
    return { y: l.y, size: l.size, chunks };
  });
}

type Gap = [number, number];

/** Intervals inside [lo, hi] that no chunk of the given lines covers, at least `min` wide. */
function gaps(lines: Line[], lo: number, hi: number, min: number): Gap[] {
  const spans = lines.flatMap((l) => l.chunks.map((c) => [c.x0, c.x1] as Gap)).sort((a, b) => a[0] - b[0]);
  const out: Gap[] = [];
  let reach = lo;
  for (const [a, b] of spans) {
    if (a - reach >= min && reach > lo) out.push([reach, a]);
    reach = Math.max(reach, b);
  }
  void hi;
  return out;
}

const sameGap = (a: Gap, b: Gap) => a[0] < b[1] && b[0] < a[1];

/** Column separators of a block of lines. A header chunk that spans a gap shared by every other line becomes a merged cell. */
function separators(block: Line[]): number[] {
  const size = Math.max(...block.map((l) => l.size));
  const lo = Math.min(...block.flatMap((l) => l.chunks.map((c) => c.x0)));
  const hi = Math.max(...block.flatMap((l) => l.chunks.map((c) => c.x1)));
  const min = size * 0.6;
  const found: Gap[] = gaps(block, lo, hi, min);
  for (let h = 0; h < Math.min(2, block.length); h++) {
    const others = block.filter((_, i) => i !== h);
    for (const g of gaps(others, lo, hi, min)) {
      if (found.some((f) => sameGap(f, g))) continue;
      const crossing = block[h].chunks.some((c) => c.x0 < g[0] - 2 && c.x1 > g[1] + 2);
      const support = others.filter((l) => l.chunks.some((c) => c.x1 <= g[0] + 1) && l.chunks.some((c) => c.x0 >= g[1] - 1)).length;
      if (crossing && support >= 3) found.push(g);
    }
  }
  return found.map((g) => (g[0] + g[1]) / 2).sort((a, b) => a - b);
}

function toTable(block: Line[]): RawTable | null {
  const seps = separators(block);
  if (!seps.length) return null;
  const lo = Math.min(...block.flatMap((l) => l.chunks.map((c) => c.x0)));
  const hi = Math.max(...block.flatMap((l) => l.chunks.map((c) => c.x1)));
  const edges = [lo, ...seps, hi];
  const C = edges.length - 1;
  const rows: string[][] = [];
  const merges: Merge[] = [];
  let aligned = 0;
  for (const line of block) {
    const cells: TextRun[][] = Array.from({ length: C }, () => []);
    const used = new Set<number>();
    for (const ch of line.chunks) {
      const cols: number[] = [];
      for (let c = 0; c < C; c++) {
        const ov = Math.min(ch.x1, edges[c + 1]) - Math.max(ch.x0, edges[c]);
        if (ov > 0.5) cols.push(c);
      }
      if (!cols.length) cols.push(Math.max(0, edges.findIndex((e, i) => i < C && ch.x0 >= e && ch.x0 < edges[i + 1])));
      cells[cols[0]].push(...ch.runs);
      cols.forEach((c) => used.add(c));
      if (cols.length > 1) merges.push({ row: rows.length, col: cols[0], rowSpan: 1, colSpan: cols.at(-1)! - cols[0] + 1 });
    }
    if (used.size >= 2) aligned++;
    rows.push(cells.map(joinRuns));
  }
  // "Columns found by alignment shared by at least three rows."
  if (aligned < 3) return null;
  const runs = block.flatMap((l) => l.chunks.flatMap((c) => c.runs));
  const rtl = isRtl(runs);
  return { method: "aligned", rows, merges, edges, top: block[0].y - block[0].size, bottom: block.at(-1)!.y + 2, rtl, runs };
}

/** Tables found by text alignment among runs that are not inside a ruled table. */
export function alignedTables(runs: TextRun[]): RawTable[] {
  const lines = linesOf(runs);
  const tables: RawTable[] = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i].chunks.length < 2) {
      i++;
      continue;
    }
    const block: Line[] = [lines[i]];
    let j = i + 1;
    while (j < lines.length) {
      const prev = block.at(-1)!;
      const gap = lines[j].y - prev.y;
      if (gap > Math.max(prev.size, lines[j].size) * 2.2) break;
      if (lines[j].chunks.length >= 2) {
        block.push(lines[j]);
        j++;
        continue;
      }
      // A single-chunk line stays in the table only between two table lines (it becomes its own row).
      const next = lines[j + 1];
      if (next && next.chunks.length >= 2 && next.y - lines[j].y <= Math.max(next.size, lines[j].size) * 2.2) {
        block.push(lines[j], next);
        j += 2;
        continue;
      }
      break;
    }
    const t = block.length >= 3 ? toTable(block) : null;
    if (t) tables.push(t);
    i = t ? j : i + 1;
  }
  return tables;
}
