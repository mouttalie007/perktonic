export type Align = "left" | "center" | "right";
export type AlignChoice = Align | "auto";

export interface Table {
  header: string[] | null;
  rows: string[][];
  columnCount: number;
}

export interface CellRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export function columnLetterToIndex(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export function columnIndexToLetter(index: number): string {
  let s = "";
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Parses "B2:E20" (or a single cell "C3"). Returns an error message for bad input. */
export function parseRange(input: string): CellRange | { error: string } {
  const value = input.trim().replace(/\$/g, "");
  if (value === "") return { error: "Range is empty." };
  const m = /^([A-Za-z]{1,3})(\d{1,7})(?::([A-Za-z]{1,3})(\d{1,7}))?$/.exec(value);
  if (!m) {
    return { error: `"${input.trim()}" is not a cell range. Use the Excel style, for example A1:D20.` };
  }
  const a = { row: Number(m[2]) - 1, col: columnLetterToIndex(m[1]) };
  const b = m[3] ? { row: Number(m[4]) - 1, col: columnLetterToIndex(m[3]) } : a;
  if (a.row < 0 || b.row < 0) return { error: "Row numbers start at 1." };
  return {
    startRow: Math.min(a.row, b.row),
    endRow: Math.max(a.row, b.row),
    startCol: Math.min(a.col, b.col),
    endCol: Math.max(a.col, b.col),
  };
}

export function applyRange(grid: string[][], range: CellRange): string[][] {
  const out: string[][] = [];
  for (let r = range.startRow; r <= range.endRow && r < grid.length; r++) {
    const src = grid[r] ?? [];
    const row: string[] = [];
    for (let c = range.startCol; c <= range.endCol; c++) row.push(src[c] ?? "");
    out.push(row);
  }
  return out;
}

/** Pads ragged rows and removes columns that are empty everywhere at the right edge. */
export function buildTable(grid: string[][], hasHeader: boolean): Table {
  let width = 0;
  for (const r of grid) width = Math.max(width, r.length);
  while (width > 0 && grid.every((r) => (r[width - 1] ?? "") === "")) width--;
  const padded = grid.map((r) => {
    const row = r.slice(0, width);
    while (row.length < width) row.push("");
    return row;
  });
  if (hasHeader && padded.length > 0) {
    return { header: padded[0], rows: padded.slice(1), columnCount: width };
  }
  return { header: null, rows: padded, columnCount: width };
}

const NUMBER_RE = /^[(]?[-+−]?[$€£¥]?\s?(?:\d{1,3}(?:[,  ]\d{3})+|\d+)(?:\.\d+)?(?:[eE][-+]?\d+)?\s?%?[)]?$/;

export function isNumeric(value: string): boolean {
  const v = value.trim();
  if (v === "") return false;
  return NUMBER_RE.test(v) || /^[-+]?\.\d+$/.test(v);
}

/** A column counts as numeric when every non-empty body cell is a number. */
export function numericColumns(table: Table): boolean[] {
  const result: boolean[] = [];
  for (let c = 0; c < table.columnCount; c++) {
    let seen = 0;
    let numeric = true;
    for (const row of table.rows) {
      const v = row[c] ?? "";
      if (v.trim() === "") continue;
      seen++;
      if (!isNumeric(v)) {
        numeric = false;
        break;
      }
    }
    result.push(numeric && seen > 0);
  }
  return result;
}

export function resolveAlignments(
  table: Table,
  defaultAlign: AlignChoice,
  overrides: AlignChoice[],
  autoRightNumbers: boolean,
): Align[] {
  const numeric = numericColumns(table);
  const out: Align[] = [];
  for (let c = 0; c < table.columnCount; c++) {
    const choice = overrides[c] && overrides[c] !== "auto" ? overrides[c] : defaultAlign;
    if (choice !== "auto") out.push(choice);
    else out.push(autoRightNumbers && numeric[c] ? "right" : "left");
  }
  return out;
}
