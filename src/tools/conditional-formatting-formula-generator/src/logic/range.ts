// A1 ranges: parsing, anchoring and column letters. Pure, no imports.

export interface Range {
  sheet: string | null;
  c1: number;
  r1: number;
  c2: number;
  r2: number;
}

export function colNumber(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

export function colLetters(n: number): string {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** "A2:F100", "Sheet1!B2:B50" or a single cell "B2". Whole columns/rows are refused (rules need a start row). */
export function parseRange(text: string): Range | null {
  const t = text.trim().replace(/\$/g, "");
  const m = /^(?:(?:'([^']+)'|([A-Za-z_][\w.]*))!)?([A-Za-z]{1,3})(\d{1,7})(?::([A-Za-z]{1,3})(\d{1,7}))?$/.exec(t);
  if (!m) return null;
  const c1 = colNumber(m[3]);
  const r1 = Number(m[4]);
  const c2 = m[5] ? colNumber(m[5]) : c1;
  const r2 = m[6] ? Number(m[6]) : r1;
  if (c1 > 16384 || c2 > 16384 || r1 < 1 || r2 < 1 || r1 > 1048576 || r2 > 1048576) return null;
  return { sheet: m[1] ?? m[2] ?? null, c1: Math.min(c1, c2), r1: Math.min(r1, r2), c2: Math.max(c1, c2), r2: Math.max(r1, r2) };
}

export function rangeText(r: Range, opts: { abs?: boolean; sheet?: boolean } = {}): string {
  const d = opts.abs ? "$" : "";
  const sheet = opts.sheet && r.sheet ? (/^[A-Za-z_][\w.]*$/.test(r.sheet) ? `${r.sheet}!` : `'${r.sheet.replace(/'/g, "''")}'!`) : "";
  const a = `${d}${colLetters(r.c1)}${d}${r.r1}`;
  const b = `${d}${colLetters(r.c2)}${d}${r.r2}`;
  return sheet + (a === b ? a : `${a}:${b}`);
}

/** The top-left cell, relative (B2). */
export const topLeft = (r: Range) => `${colLetters(r.c1)}${r.r1}`;
/** Column fixed, row relative ($D2): the anchor for "highlight the whole row by one column". */
export const rowAnchored = (col: number, r: Range) => `$${colLetters(col)}${r.r1}`;
/** One column of the range, fully absolute ($B$2:$B$100). */
export const absColumn = (col: number, r: Range) => `$${colLetters(col)}$${r.r1}:$${colLetters(col)}$${r.r2}`;

export const rowCount = (r: Range) => r.r2 - r.r1 + 1;
export const colCount = (r: Range) => r.c2 - r.c1 + 1;
