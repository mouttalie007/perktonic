import type { Merge, PageData, Rule, TextRun } from "./types";
import { cluster, isRtl, joinRuns } from "./util";

export interface RawTable {
  method: "ruled" | "aligned";
  rows: string[][];
  merges: Merge[];
  edges: number[];
  top: number;
  bottom: number;
  rtl: boolean;
  runs: TextRun[];
}

/** Collinear rules that touch or overlap become one. */
function normalise(rules: Rule[]): Rule[] {
  const out: Rule[] = [];
  for (const dir of ["h", "v"] as const) {
    const list = rules.filter((r) => r.dir === dir).sort((a, b) => a.at - b.at || a.from - b.from);
    const groups: Rule[][] = [];
    for (const r of list) {
      const g = groups.find((x) => Math.abs(x[0].at - r.at) <= 1.5);
      if (g) g.push(r);
      else groups.push([r]);
    }
    for (const g of groups) {
      g.sort((a, b) => a.from - b.from);
      let cur = { ...g[0] };
      for (const r of g.slice(1)) {
        if (r.from <= cur.to + 2) cur.to = Math.max(cur.to, r.to);
        else {
          out.push(cur);
          cur = { ...r };
        }
      }
      out.push(cur);
    }
  }
  return out;
}

const crosses = (h: Rule, v: Rule) => v.at >= h.from - 2.5 && v.at <= h.to + 2.5 && h.at >= v.from - 2.5 && h.at <= v.to + 2.5;

export function ruledTables(page: PageData): RawTable[] {
  const rules = normalise(page.rules);
  const parent = rules.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < rules.length; i++)
    for (let j = i + 1; j < rules.length; j++) {
      const a = rules[i];
      const b = rules[j];
      if (a.dir !== b.dir && crosses(a.dir === "h" ? a : b, a.dir === "h" ? b : a)) parent[find(i)] = find(j);
    }
  const comps = new Map<number, Rule[]>();
  rules.forEach((r, i) => comps.set(find(i), [...(comps.get(find(i)) ?? []), r]));
  const tables: RawTable[] = [];
  for (const comp of comps.values()) {
    const hs = comp.filter((r) => r.dir === "h");
    const vs = comp.filter((r) => r.dir === "v");
    if (hs.length < 2 || vs.length < 2) continue;
    const xs = cluster(vs.map((v) => v.at), 3);
    const ys = cluster(hs.map((h) => h.at), 3);
    if (xs.length < 2 || ys.length < 2) continue;
    const R = ys.length - 1;
    const C = xs.length - 1;
    const vAt = (x: number, y: number) => vs.some((v) => Math.abs(v.at - x) <= 3 && y >= v.from - 1 && y <= v.to + 1);
    const hAt = (y: number, x: number) => hs.some((h) => Math.abs(h.at - y) <= 3 && x >= h.from - 1 && x <= h.to + 1);
    const id = (r: number, c: number) => r * C + c;
    const p = Array.from({ length: R * C }, (_, i) => i);
    const f = (i: number): number => (p[i] === i ? i : (p[i] = f(p[i])));
    for (let r = 0; r < R; r++)
      for (let c = 0; c < C; c++) {
        const ym = (ys[r] + ys[r + 1]) / 2;
        const xm = (xs[c] + xs[c + 1]) / 2;
        if (c < C - 1 && !vAt(xs[c + 1], ym)) p[f(id(r, c))] = f(id(r, c + 1));
        if (r < R - 1 && !hAt(ys[r + 1], xm)) p[f(id(r, c))] = f(id(r + 1, c));
      }
    const groups = new Map<number, { r0: number; r1: number; c0: number; c1: number }>();
    for (let r = 0; r < R; r++)
      for (let c = 0; c < C; c++) {
        const g = groups.get(f(id(r, c)));
        if (!g) groups.set(f(id(r, c)), { r0: r, r1: r, c0: c, c1: c });
        else {
          g.r0 = Math.min(g.r0, r);
          g.r1 = Math.max(g.r1, r);
          g.c0 = Math.min(g.c0, c);
          g.c1 = Math.max(g.c1, c);
        }
      }
    const cellOf = (r: number, c: number) => groups.get(f(id(r, c)))!;
    const inside = page.runs.filter((t) => {
      const cy = t.y - t.size * 0.3;
      const cx = (t.x0 + t.x1) / 2;
      return cx > xs[0] - 1 && cx < xs[C] + 1 && cy > ys[0] - 1 && cy < ys[R] + 1;
    });
    const buckets = new Map<string, TextRun[]>();
    for (const t of inside) {
      const cy = t.y - t.size * 0.3;
      const cx = (t.x0 + t.x1) / 2;
      const r = Math.max(0, ys.findIndex((y, i) => i < R && cy >= y && cy < ys[i + 1]));
      const c = Math.max(0, xs.findIndex((x, i) => i < C && cx >= x && cx < xs[i + 1]));
      const g = cellOf(r, c);
      const key = `${g.r0},${g.c0}`;
      buckets.set(key, [...(buckets.get(key) ?? []), t]);
    }
    const rows = Array.from({ length: R }, () => Array.from({ length: C }, () => ""));
    for (const [key, runs] of buckets) {
      const [r, c] = key.split(",").map(Number);
      rows[r][c] = joinRuns(runs);
    }
    const merges: Merge[] = [];
    for (const g of new Set(groups.values())) if (g.r1 > g.r0 || g.c1 > g.c0) merges.push({ row: g.r0, col: g.c0, rowSpan: g.r1 - g.r0 + 1, colSpan: g.c1 - g.c0 + 1 });
    merges.sort((a, b) => a.row - b.row || a.col - b.col);
    if (!inside.length) continue;
    const rtl = isRtl(inside);
    tables.push({ method: "ruled", rows, merges, edges: xs, top: ys[0], bottom: ys[R], rtl, runs: inside });
  }
  return tables.sort((a, b) => a.top - b.top);
}
