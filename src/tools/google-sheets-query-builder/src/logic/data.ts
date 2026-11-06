import { detectDelimiter, parseCsv } from "./csvParser";
import { convert, typeOfCell, type ColType, type Value } from "./values";

export const MAX_PASTE_BYTES = 5 * 1024 * 1024;
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_COLUMNS = 200;

export interface Column {
  index: number;
  /** Identifier used inside the query: a column letter (A, B…) or Col1, Col2… */
  id: string;
  /** What Google shows as the header: the header row(s) joined, or nothing. */
  label: string;
  type: ColType;
  /** Cells whose type differs from the column type; Google turns them into empty values. */
  mismatched: number;
}

export interface Table {
  columns: Column[];
  rows: Value[][];
  headerRows: number;
}

export function colLetter(n: number): string {
  let s = "";
  let x = n;
  while (x > 0) {
    const r = (x - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

export function letterToNumber(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64;
  return n;
}

export interface TableOptions {
  headerRows: 0 | 1 | 2;
  /** First column letter of the data range (e.g. C for C1:F200), so ids match the sheet. */
  firstColumn: string;
  colNotation: boolean;
}

export function parseGrid(text: string): string[][] {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const delim = firstLine.includes("\t") ? "\t" : detectDelimiter(clean);
  const rows = parseCsv(clean, delim).rows.filter((r) => !(r.length === 1 && r[0] === ""));
  return rows;
}

/**
 * Builds a typed table the way Google Sheets does for QUERY: each column gets
 * the type most of its data cells have, and cells of another type become
 * empty (null). Header rows are joined with a space to form the labels.
 */
export function buildTable(grid: string[][], opts: TableOptions): Table {
  const width = grid.reduce((w, r) => Math.max(w, r.length), 0);
  if (width > MAX_COLUMNS) throw new Error(`The data has ${width} columns; the limit is ${MAX_COLUMNS}.`);
  const header = grid.slice(0, opts.headerRows);
  const body = grid.slice(opts.headerRows);
  const start = letterToNumber(opts.firstColumn || "A");
  const columns: Column[] = [];
  for (let c = 0; c < width; c++) {
    const counts: Record<ColType, number> = { number: 0, string: 0, boolean: 0, date: 0, datetime: 0 };
    for (const r of body) {
      const t = typeOfCell(r[c] ?? "");
      if (t) counts[t]++;
    }
    // Ties go to text, as in Google Sheets.
    let type: ColType = "string";
    let best = counts.string;
    for (const t of ["number", "date", "datetime", "boolean"] as ColType[]) if (counts[t] > best) [type, best] = [t, counts[t]];
    if (type === "date" && counts.datetime > 0) type = "datetime";
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const mismatched = total - counts[type] - (type === "datetime" ? counts.date : 0);
    const label = header.map((h) => (h[c] ?? "").trim()).filter(Boolean).join(" ");
    columns.push({ index: c, id: opts.colNotation ? `Col${c + 1}` : colLetter(start + c), label, type, mismatched });
  }
  const fits = (cell: ColType | null, col: ColType) => cell === col || (col === "datetime" && cell === "date");
  const rows = body.map((r) =>
    columns.map((col) => {
      const raw = r[col.index] ?? "";
      return fits(typeOfCell(raw), col.type) ? convert(raw, col.type) : null;
    }),
  );
  return { columns, rows, headerRows: opts.headerRows };
}

/** First column letter of a range such as Sales!C2:H or 'My data'!B:B (A when it cannot be read). */
export function firstColumnOf(range: string): string {
  const body = range.includes("!") ? range.slice(range.lastIndexOf("!") + 1) : range;
  const m = /^\$?([A-Za-z]{1,3})/.exec(body.trim());
  return m ? m[1].toUpperCase() : "A";
}
