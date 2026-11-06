// Editing the recognised grid: every operation is pure and returns a new grid.
import type { Cell, Grid } from "./table";

const blank = (): Cell => ({ text: "", confidence: null, box: null, span: 1 });
const width = (g: Grid) => Math.max(0, ...g.rows.map((r) => r.length));
const joinBox = (a: Cell["box"], b: Cell["box"]) => (a && b ? { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) } : (a ?? b));
const minConf = (a: number | null, b: number | null) => (a === null ? b : b === null ? a : Math.min(a, b));
const join = (a: Cell, b: Cell, sep: string): Cell => ({ text: [a.text, b.text].filter(Boolean).join(sep), confidence: minConf(a.confidence, b.confidence), box: joinBox(a.box, b.box), span: 1 });

/** Column operations undo merged cells (each covered cell becomes a normal empty cell). */
const flat = (g: Grid): Cell[][] => g.rows.map((r) => r.map((c) => ({ ...c, span: 1 })));

/** The visitor typed a value: it is no longer an OCR guess, so it is not flagged. */
export function setText(g: Grid, r: number, c: number, text: string): Grid {
  return { ...g, rows: g.rows.map((row, i) => (i === r ? row.map((cell, j) => (j === c ? { ...cell, text, confidence: null } : cell)) : row)) };
}

export function addRow(g: Grid, after: number): Grid {
  const rows = [...g.rows];
  rows.splice(after + 1, 0, Array.from({ length: width(g) }, blank));
  return { ...g, rows };
}

export function removeRow(g: Grid, r: number): Grid {
  return { ...g, rows: g.rows.filter((_, i) => i !== r) };
}

/** Row r and the row below become one row (texts joined line by line). */
export function mergeRows(g: Grid, r: number): Grid {
  if (r + 1 >= g.rows.length) return g;
  const a = flat(g)[r];
  const b = flat(g)[r + 1];
  const merged = Array.from({ length: Math.max(a.length, b.length) }, (_, c) => join(a[c] ?? blank(), b[c] ?? blank(), "\n"));
  const rows = [...g.rows];
  rows.splice(r, 2, merged);
  return { ...g, rows };
}

/** Undo of mergeRows: the second and following lines of each cell move to a new row below. */
export function splitRow(g: Grid, r: number): Grid {
  const row = flat(g)[r];
  if (!row || !row.some((c) => c.text.includes("\n"))) return g;
  const top = row.map((c) => ({ ...c, text: c.text.split("\n")[0] }));
  const bottom = row.map((c) => (c.text.includes("\n") ? { ...c, text: c.text.split("\n").slice(1).join("\n") } : blank()));
  const rows = [...g.rows];
  rows.splice(r, 1, top, bottom);
  return { ...g, rows };
}

export function addColumn(g: Grid, after: number): Grid {
  return { ...g, rows: flat(g).map((r) => [...r.slice(0, after + 1), blank(), ...r.slice(after + 1)]) };
}

export function removeColumn(g: Grid, c: number): Grid {
  return { ...g, rows: flat(g).map((r) => r.filter((_, j) => j !== c)) };
}

/** Column c and the next column become one (texts joined with a space). */
export function mergeColumns(g: Grid, c: number): Grid {
  if (c + 1 >= width(g)) return g;
  return { ...g, rows: flat(g).map((r) => [...r.slice(0, c), join(r[c] ?? blank(), r[c + 1] ?? blank(), " "), ...r.slice(c + 2)]) };
}

/**
 * Splits column c in two at the last space of each cell (the usual OCR mistake: "Coffee 120" read
 * as one cell). In a right-to-left table the reading order is respected.
 */
export function splitColumn(g: Grid, c: number): Grid {
  const rows = flat(g).map((r) => {
    const cell = r[c] ?? blank();
    const at = cell.text.lastIndexOf(" ");
    const [first, second] = at > 0 ? [cell.text.slice(0, at), cell.text.slice(at + 1)] : [cell.text, ""];
    const a = { ...cell, text: first };
    const b = { ...cell, text: second, box: second ? cell.box : null, confidence: second ? cell.confidence : null };
    return [...r.slice(0, c), a, b, ...r.slice(c + 1)];
  });
  return { ...g, rows };
}

/** Texts for export: merged cells keep their text in the first cell only. */
export function texts(g: Grid): string[][] {
  const w = width(g);
  return g.rows.map((r) => Array.from({ length: w }, (_, c) => r[c]?.text ?? ""));
}

export function merges(g: Grid): { row: number; col: number; rowSpan: number; colSpan: number }[] {
  const out: { row: number; col: number; rowSpan: number; colSpan: number }[] = [];
  g.rows.forEach((r, i) => r.forEach((c, j) => c.span > 1 && out.push({ row: i, col: j, rowSpan: 1, colSpan: c.span })));
  return out;
}
