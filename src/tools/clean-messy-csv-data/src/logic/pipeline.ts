import { analyzeDateColumn, convertDate, type ColumnDateStatus, type DateOutput, type DayOrder } from "./dates";
import { repairMojibake } from "./encoding";
import { normalizeHeaders, type HeaderStyle } from "./headers";
import { normalizeSpaces, removeInvisible, straightenQuotes, trimCell } from "./text";

export type StepId =
  | "mojibake"
  | "invisible"
  | "spaces"
  | "quotes"
  | "trim"
  | "blanks"
  | "dates"
  | "emptyRows"
  | "emptyColumns"
  | "headers"
  | "duplicates";

export const STEP_LABELS: Record<StepId, string> = {
  mojibake: "Repair garbled characters (mojibake)",
  invisible: "Remove zero-width and control characters",
  spaces: "Replace non-breaking and odd spaces",
  quotes: "Straighten smart quotes",
  trim: "Trim whitespace",
  blanks: "Standardise blank values",
  dates: "Standardise dates",
  emptyRows: "Remove empty rows",
  emptyColumns: "Remove empty columns",
  headers: "Normalise header names",
  duplicates: "Remove duplicate rows",
};

export const STEP_ORDER: StepId[] = [
  "mojibake",
  "invisible",
  "spaces",
  "quotes",
  "trim",
  "blanks",
  "dates",
  "emptyRows",
  "emptyColumns",
  "headers",
  "duplicates",
];

export const DEFAULT_BLANK_TOKENS = ["n/a", "na", "#n/a", "null", "none", "nil", "-", "--", "nan", "(blank)", "missing"];

export interface CleanOptions {
  hasHeader: boolean;
  steps: Record<StepId, boolean>;
  collapseSpaces: boolean;
  guillemets: boolean;
  blankTokens: string[];
  blankFill: string;
  dateOutput: DateOutput;
  /** User answers for date columns, keyed by original column index. "skip" leaves a column alone. */
  dateOrders: Record<number, DayOrder | "skip">;
  headerStyle: HeaderStyle;
  dedupeIgnoreCase: boolean;
}

export const DEFAULT_CLEAN_OPTIONS: CleanOptions = {
  hasHeader: true,
  steps: {
    mojibake: true,
    invisible: true,
    spaces: true,
    quotes: true,
    trim: true,
    blanks: true,
    dates: true,
    emptyRows: true,
    emptyColumns: false,
    headers: true,
    duplicates: true,
  },
  collapseSpaces: true,
  guillemets: false,
  blankTokens: DEFAULT_BLANK_TOKENS,
  blankFill: "",
  dateOutput: "iso",
  dateOrders: {},
  headerStyle: "snake",
  dedupeIgnoreCase: false,
};

export interface Change {
  step: StepId;
  /** 1-based row number in the original file (the header is row 1). */
  row: number;
  /** Original column index, or -1 for whole-row changes. */
  col: number;
  before: string;
  after: string;
}

export interface DateColumnReport {
  col: number;
  name: string;
  status: ColumnDateStatus;
  order: DayOrder | null;
  source: "data" | "user" | "none";
  converted: number;
  unparsed: number;
  /** True when the tool needs the user to choose DD/MM or MM/DD. */
  needsDecision: boolean;
}

export interface CleanReport {
  counts: Record<StepId, number>;
  changes: Change[];
  /** True when more changes happened than are listed in `changes` (counts stay exact). */
  changesTruncated: boolean;
  cellsModified: number;
  rowsRemoved: number;
  columnsRemoved: number;
  dateColumns: DateColumnReport[];
  rowsIn: number;
  rowsOut: number;
  columnsIn: number;
  columnsOut: number;
}

export interface CleanResult {
  header: string[] | null;
  rows: string[][];
  /** Original 1-based row number of every output row, for highlighting. */
  rowNumbers: number[];
  /** Original column index of every output column. */
  columnIndexes: number[];
  report: CleanReport;
}

const MAX_LISTED_CHANGES = 20000;

export function cleanTable(input: string[][], options: CleanOptions, onProgress?: (fraction: number, label: string) => void): CleanResult {
  const width = input.reduce((w, r) => Math.max(w, r.length), 0);
  let rows = input.map((r) => {
    const row = r.slice();
    while (row.length < width) row.push("");
    return row;
  });
  let rowNumbers = rows.map((_, i) => i + 1);
  let columnIndexes = Array.from({ length: width }, (_, i) => i);
  const steps = options.steps;
  const counts = Object.fromEntries(STEP_ORDER.map((s) => [s, 0])) as Record<StepId, number>;
  const changes: Change[] = [];
  let truncated = false;
  const modified = new Set<number>();
  const record = (step: StepId, row: number, col: number, before: string, after: string) => {
    counts[step]++;
    if (col >= 0) modified.add(row * (width + 1) + col);
    if (changes.length < MAX_LISTED_CHANGES) changes.push({ step, row, col, before, after });
    else truncated = true;
  };

  const cellSteps: { id: StepId; fn: (v: string) => string }[] = [];
  if (steps.mojibake) cellSteps.push({ id: "mojibake", fn: repairMojibake });
  if (steps.invisible) cellSteps.push({ id: "invisible", fn: removeInvisible });
  if (steps.spaces) cellSteps.push({ id: "spaces", fn: normalizeSpaces });
  if (steps.quotes) cellSteps.push({ id: "quotes", fn: (v) => straightenQuotes(v, options.guillemets) });
  if (steps.trim) cellSteps.push({ id: "trim", fn: (v) => trimCell(v, options.collapseSpaces) });
  if (steps.blanks) {
    const tokens = new Set(options.blankTokens.map((t) => t.trim().toLowerCase()).filter((t) => t !== ""));
    cellSteps.push({
      id: "blanks",
      fn: (v) => {
        const isBlank = v.trim() === "" || tokens.has(v.trim().toLowerCase());
        return isBlank ? options.blankFill : v;
      },
    });
  }

  const firstData = options.hasHeader ? 1 : 0;
  const total = rows.length || 1;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < width; c++) {
      let v = row[c];
      for (const step of cellSteps) {
        // Header cells are labels, so blank-token rules do not apply to them.
        if (step.id === "blanks" && r < firstData) continue;
        const next = step.fn(v);
        if (next !== v) {
          record(step.id, rowNumbers[r], c, v, next);
          v = next;
        }
      }
      row[c] = v;
    }
    if (onProgress && r % 20000 === 0) onProgress((r / total) * 0.7, "Cleaning cells");
  }

  const dateColumns: DateColumnReport[] = [];
  if (steps.dates) {
    onProgress?.(0.75, "Checking dates");
    for (let c = 0; c < width; c++) {
      const values: string[] = [];
      for (let r = firstData; r < rows.length; r++) values.push(rows[r][c]);
      const status = analyzeDateColumn(values);
      if (status.kind === "not-date") continue;
      const answer = options.dateOrders[c];
      if (answer === "skip") {
        dateColumns.push({ col: c, name: headerName(rows, c, options.hasHeader), status, order: null, source: "user", converted: 0, unparsed: 0, needsDecision: false });
        continue;
      }
      let order: DayOrder | null = null;
      let source: DateColumnReport["source"] = "none";
      if (answer) {
        order = answer;
        source = "user";
      } else if (status.kind === "detected") {
        order = status.order;
        source = "data";
      }
      const needsDecision = order === null && (status.kind === "ambiguous" || status.kind === "mixed");
      let converted = 0;
      let unparsed = 0;
      if (!needsDecision) {
        for (let r = firstData; r < rows.length; r++) {
          const v = rows[r][c];
          if (v.trim() === "") continue;
          const out = convertDate(v, order, options.dateOutput);
          if (out === null) {
            unparsed++;
            continue;
          }
          if (out !== v) {
            record("dates", rowNumbers[r], c, v, out);
            rows[r][c] = out;
            converted++;
          }
        }
      }
      dateColumns.push({ col: c, name: headerName(rows, c, options.hasHeader), status, order, source, converted, unparsed, needsDecision });
    }
  }

  if (steps.emptyRows) {
    const kept: string[][] = [];
    const keptNumbers: number[] = [];
    rows.forEach((row, r) => {
      if (r >= firstData && row.every((v) => v.trim() === "")) {
        record("emptyRows", rowNumbers[r], -1, "(empty row)", "(removed)");
      } else {
        kept.push(row);
        keptNumbers.push(rowNumbers[r]);
      }
    });
    rows = kept;
    rowNumbers = keptNumbers;
  }

  if (steps.emptyColumns && rows.length > firstData) {
    const keep: number[] = [];
    for (let c = 0; c < columnIndexes.length; c++) {
      let empty = true;
      for (let r = firstData; r < rows.length; r++) {
        if (rows[r][c].trim() !== "") {
          empty = false;
          break;
        }
      }
      if (empty) record("emptyColumns", 1, -1, `column ${columnIndexes[c] + 1} "${headerName(rows, c, options.hasHeader)}"`, "(removed)");
      else keep.push(c);
    }
    if (keep.length !== columnIndexes.length) {
      rows = rows.map((row) => keep.map((c) => row[c]));
      columnIndexes = keep.map((c) => columnIndexes[c]);
    }
  }

  let header: string[] | null = null;
  if (options.hasHeader && rows.length > 0) {
    header = rows[0];
    if (steps.headers) {
      const fixed = normalizeHeaders(header, options.headerStyle);
      fixed.forEach((h, i) => {
        if (h !== header![i]) record("headers", 1, columnIndexes[i], header![i], h);
      });
      header = fixed;
    }
    rows = rows.slice(1);
    rowNumbers = rowNumbers.slice(1);
  }

  if (steps.duplicates) {
    onProgress?.(0.9, "Finding duplicates");
    const seen = new Map<string, number>();
    const kept: string[][] = [];
    const keptNumbers: number[] = [];
    rows.forEach((row, r) => {
      const key = options.dedupeIgnoreCase ? row.map((v) => v.toLowerCase().replace(/\s+/g, " ").trim()).join("\u0000") : row.join("\u0000");
      const first = seen.get(key);
      if (first !== undefined) {
        record("duplicates", rowNumbers[r], -1, `duplicate of row ${first}`, "(removed)");
      } else {
        seen.set(key, rowNumbers[r]);
        kept.push(row);
        keptNumbers.push(rowNumbers[r]);
      }
    });
    rows = kept;
    rowNumbers = keptNumbers;
  }

  // Cells in rows that were later removed still count as modified; they were changed before removal.
  const report: CleanReport = {
    counts,
    changes,
    changesTruncated: truncated,
    cellsModified: modified.size,
    rowsRemoved: counts.emptyRows + counts.duplicates,
    columnsRemoved: counts.emptyColumns,
    dateColumns,
    rowsIn: input.length - (options.hasHeader && input.length > 0 ? 1 : 0),
    rowsOut: rows.length,
    columnsIn: width,
    columnsOut: columnIndexes.length,
  };
  return { header, rows, rowNumbers, columnIndexes, report };
}

function headerName(rows: string[][], c: number, hasHeader: boolean): string {
  const name = hasHeader && rows.length > 0 ? rows[0][c] : "";
  return name && name.trim() !== "" ? name : `Column ${c + 1}`;
}
