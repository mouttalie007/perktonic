import type { Delimiter } from "./csvParser";
import { flatten, type ArrayMode } from "./nesting";
import type { JsonValue } from "./values";

export interface JsonToCsvOptions {
  delimiter: Delimiter;
  includeHeader: boolean;
  flatten: boolean;
  separator: string;
  arrays: ArrayMode;
  quoteAll: boolean;
  lineEnding: "\n" | "\r\n";
  /** Prefix text that starts with = + - @ so spreadsheets do not run it as a formula. */
  protectFormulas: boolean;
}

export type JsonParseResult = { ok: true; records: JsonValue[]; note: string | null } | { ok: false; error: string };

function lineCol(text: string, pos: number): string {
  const before = text.slice(0, pos);
  const line = before.split("\n").length;
  const col = pos - before.lastIndexOf("\n");
  return `line ${line}, column ${col}`;
}

/** Explains invalid JSON with a line/column instead of the engine's raw message. */
export function describeJsonError(text: string, err: unknown): string {
  const msg = err instanceof Error ? err.message : "";
  const lc = /line (\d+) column (\d+)/.exec(msg);
  const pos = /position (\d+)/.exec(msg);
  let where = "";
  if (lc) where = `line ${lc[1]}, column ${lc[2]}`;
  else if (pos) where = lineCol(text, Number(pos[1]));
  const hint = /Unexpected end/i.test(msg)
    ? "The text ends too early; a closing ] or } is probably missing."
    : /Unexpected token|Expected/i.test(msg)
      ? "Look for a missing comma, a trailing comma, single quotes or an unquoted key there."
      : "";
  return `This is not valid JSON${where ? ` (problem near ${where})` : ""}. ${hint}`.trim();
}

/**
 * Accepts an array of objects, an array of arrays, a single object, an
 * object wrapping one array (API responses such as {"data": [...]}) or NDJSON.
 */
export function parseJsonRecords(text: string): JsonParseResult {
  const trimmed = text.trim();
  if (trimmed === "") return { ok: false, error: "There is no JSON to convert." };
  let value: JsonValue;
  try {
    value = JSON.parse(trimmed) as JsonValue;
  } catch (err) {
    const lines = trimmed.split(/\r?\n/).filter((l) => l.trim() !== "");
    if (lines.length > 1 && lines.every((l) => /^\s*[[{]/.test(l))) {
      try {
        return { ok: true, records: lines.map((l) => JSON.parse(l) as JsonValue), note: "Read as NDJSON (one JSON value per line)." };
      } catch {
        // Fall through to the error for the whole document.
      }
    }
    return { ok: false, error: describeJsonError(trimmed, err) };
  }
  if (Array.isArray(value)) return { ok: true, records: value, note: null };
  if (value !== null && typeof value === "object") {
    const arrays = Object.entries(value).filter(([, v]) => Array.isArray(v));
    if (arrays.length === 1 && Object.keys(value).length <= 3) {
      return { ok: true, records: arrays[0][1] as JsonValue[], note: `Converted the "${arrays[0][0]}" array inside the object.` };
    }
    return { ok: true, records: [value], note: "The JSON is a single object, so the CSV has one row." };
  }
  return { ok: false, error: "The JSON is a single value. Use an array of objects, e.g. [{\"name\": \"Ada\"}]." };
}

function cellText(v: JsonValue | undefined): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

export function quoteCell(value: string, opts: Pick<JsonToCsvOptions, "delimiter" | "quoteAll" | "protectFormulas">, isString: boolean): string {
  let v = value;
  if (opts.protectFormulas && isString && /^[=+\-@\t\r]/.test(v)) v = "'" + v;
  const needs =
    opts.quoteAll || v.includes(opts.delimiter) || v.includes("\"") || v.includes("\n") || v.includes("\r") || /^\s|\s$/.test(v);
  return needs ? `"${v.replace(/"/g, "\"\"")}"` : v;
}

export interface JsonToCsvResult {
  csv: string;
  rows: number;
  columns: string[];
  preview: string[][];
}

export function recordsToCsv(records: JsonValue[], opts: JsonToCsvOptions): JsonToCsvResult {
  const arrayRows = records.length > 0 && records.every((r) => Array.isArray(r));
  const lines: string[] = [];
  const preview: string[][] = [];
  const write = (cells: JsonValue[]) => {
    const texts = cells.map(cellText);
    if (preview.length < 11) preview.push(texts);
    lines.push(texts.map((t, i) => quoteCell(t, opts, typeof cells[i] === "string")).join(opts.delimiter));
  };

  if (arrayRows) {
    for (const r of records as JsonValue[][]) write(r);
    const width = Math.max(0, ...(records as JsonValue[][]).map((r) => r.length));
    return { csv: lines.join(opts.lineEnding) + opts.lineEnding, rows: records.length, columns: Array.from({ length: width }, (_, i) => `column_${i + 1}`), preview };
  }

  const flatRows = records.map((r): Record<string, JsonValue> => {
    if (r === null || typeof r !== "object" || Array.isArray(r)) return { value: r };
    return opts.flatten ? flatten(r, opts.separator, opts.arrays) : (r as Record<string, JsonValue>);
  });
  const columns: string[] = [];
  const seen = new Set<string>();
  for (const r of flatRows) {
    for (const k of Object.keys(r)) {
      if (!seen.has(k)) {
        seen.add(k);
        columns.push(k);
      }
    }
  }
  if (opts.includeHeader) write(columns);
  for (const r of flatRows) write(columns.map((c) => (r[c] === undefined ? null : r[c])));
  return { csv: lines.join(opts.lineEnding) + opts.lineEnding, rows: flatRows.length, columns, preview };
}
