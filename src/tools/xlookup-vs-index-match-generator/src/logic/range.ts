/** An A1-style rectangle. Whole columns have null rows; whole rows have null columns. */
export interface Range {
  sheet: string;
  c1: number | null;
  r1: number | null;
  c2: number | null;
  r2: number | null;
  absC1: boolean;
  absR1: boolean;
  absC2: boolean;
  absR2: boolean;
}

export function colToNum(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64;
  return n;
}

export function numToCol(n: number): string {
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const CELL = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)$/;
const COL = /^(\$?)([A-Za-z]{1,3})$/;
const ROW = /^(\$?)(\d+)$/;

export function parseRange(text: string): Range | null {
  const bang = text.lastIndexOf("!");
  const sheet = bang >= 0 ? text.slice(0, bang + 1) : "";
  const body = bang >= 0 ? text.slice(bang + 1) : text;
  const [a, b = a] = body.split(":");
  let m1 = CELL.exec(a);
  let m2 = CELL.exec(b);
  if (m1 && m2) {
    const r: Range = { sheet, c1: colToNum(m1[2]), r1: Number(m1[4]), c2: colToNum(m2[2]), r2: Number(m2[4]), absC1: !!m1[1], absR1: !!m1[3], absC2: !!m2[1], absR2: !!m2[3] };
    return normalize(r);
  }
  m1 = COL.exec(a);
  m2 = COL.exec(b);
  if (m1 && m2 && body.includes(":")) return normalize({ sheet, c1: colToNum(m1[2]), r1: null, c2: colToNum(m2[2]), r2: null, absC1: !!m1[1], absR1: false, absC2: !!m2[1], absR2: false });
  const r1 = ROW.exec(a);
  const r2 = ROW.exec(b);
  if (r1 && r2 && body.includes(":")) return normalize({ sheet, c1: null, r1: Number(r1[2]), c2: null, r2: Number(r2[2]), absC1: false, absR1: !!r1[1], absC2: false, absR2: !!r2[1] });
  return null;
}

function normalize(r: Range): Range {
  if (r.c1 !== null && r.c2 !== null && r.c1 > r.c2) [r.c1, r.c2, r.absC1, r.absC2] = [r.c2, r.c1, r.absC2, r.absC1];
  if (r.r1 !== null && r.r2 !== null && r.r1 > r.r2) [r.r1, r.r2, r.absR1, r.absR2] = [r.r2, r.r1, r.absR2, r.absR1];
  return r;
}

export function formatRange(r: Range): string {
  const d = (abs: boolean) => (abs ? "$" : "");
  if (r.r1 === null) return `${r.sheet}${d(r.absC1)}${numToCol(r.c1!)}:${d(r.absC2)}${numToCol(r.c2!)}`;
  if (r.c1 === null) return `${r.sheet}${d(r.absR1)}${r.r1}:${d(r.absR2)}${r.r2}`;
  const a = `${d(r.absC1)}${numToCol(r.c1)}${d(r.absR1)}${r.r1}`;
  const b = `${d(r.absC2)}${numToCol(r.c2!)}${d(r.absR2)}${r.r2}`;
  return `${r.sheet}${a === b ? a : `${a}:${b}`}`;
}

export function width(r: Range): number | null {
  return r.c1 === null || r.c2 === null ? null : r.c2 - r.c1 + 1;
}

export function height(r: Range): number | null {
  return r.r1 === null || r.r2 === null ? null : r.r2 - r.r1 + 1;
}

/** Columns from..to (1-based, inclusive) of a range, keeping its rows and $ signs. */
export function columns(r: Range, from: number, to = from): Range | null {
  if (r.c1 === null) return null;
  const c1 = r.c1 + from - 1;
  const c2 = r.c1 + to - 1;
  if (r.c2 !== null && c2 > r.c2) return null;
  return { ...r, c1, c2, absC1: r.absC1, absC2: r.absC1 };
}

export function rows(r: Range, from: number, to = from): Range | null {
  if (r.r1 === null) return null;
  const r1 = r.r1 + from - 1;
  const r2 = r.r1 + to - 1;
  if (r.r2 !== null && r2 > r.r2) return null;
  return { ...r, r1, r2, absR1: r.absR1, absR2: r.absR1 };
}

/** The smallest range covering both (same sheet and same rows or columns), used to rebuild a VLOOKUP table. */
export function spanColumns(a: Range, b: Range): Range {
  return { ...a, c1: Math.min(a.c1!, b.c1!), c2: Math.max(a.c2!, b.c2!), absC1: a.absC1, absC2: b.absC2 || a.absC2 };
}

export function spanRows(a: Range, b: Range): Range {
  return { ...a, r1: Math.min(a.r1!, b.r1!), r2: Math.max(a.r2!, b.r2!), absR1: a.absR1, absR2: b.absR2 || a.absR2 };
}

export function sameRows(a: Range, b: Range): boolean {
  return a.sheet === b.sheet && a.r1 === b.r1 && a.r2 === b.r2;
}

export function sameColumns(a: Range, b: Range): boolean {
  return a.sheet === b.sheet && a.c1 === b.c1 && a.c2 === b.c2;
}

export function orientation(r: Range): "vertical" | "horizontal" | "single" | "block" {
  const w = width(r);
  const h = height(r);
  if (w === 1 && h === 1) return "single";
  if (w === 1 || (r.r1 === null && w === 1)) return "vertical";
  if (h === 1 || (r.c1 === null && h === 1)) return "horizontal";
  return "block";
}
