import { detectDelimiter, parseCsv, type Delimiter } from "./csvParser";
import { inferType } from "./infer";
import { TYPE_SAMPLE_ROWS } from "./limits";
import { columnNames } from "./names";
import type { ColumnInfo, Dialect } from "./types";

export interface Table {
  headers: string[];
  rows: string[][];
  delimiter: Delimiter;
  unclosedQuote: boolean;
  /** Rows that had more or fewer cells than the header. */
  ragged: number;
}

/** Reads CSV text: delimiter detection (comma, semicolon, tab, pipe), RFC 4180 quoting, header or not. */
export function readTable(text: string, hasHeader: boolean, delimiter: Delimiter | "auto" = "auto"): Table {
  const clean = text.replace(/^﻿/, "");
  const d = delimiter === "auto" ? detectDelimiter(clean) : delimiter;
  const parsed = parseCsv(clean, d);
  const grid = parsed.rows.filter((r) => !(r.length === 1 && r[0] === ""));
  const width = grid.reduce((w, r) => Math.max(w, r.length), 0);
  const headers = hasHeader && grid.length ? grid[0].map((h) => h.trim()) : Array.from({ length: width }, (_, i) => `column_${i + 1}`);
  while (headers.length < width) headers.push(`column_${headers.length + 1}`);
  const rows = hasHeader ? grid.slice(1) : grid;
  let ragged = 0;
  for (const r of rows) if (r.length !== headers.length) ragged++;
  return { headers, rows, delimiter: d, unclosedQuote: parsed.unclosedQuote, ragged };
}

export function analyzeColumns(table: Table, dialect: Dialect): ColumnInfo[] {
  const names = columnNames(table.headers, dialect);
  const sample = table.rows.slice(0, TYPE_SAMPLE_ROWS);
  return table.headers.map((h, i) => {
    const values = sample.map((r) => (r[i] ?? "").trim() === "" ? "" : r[i] ?? "");
    const inf = inferType(values.map((v) => v.trim()));
    const examples: string[] = [];
    for (const v of values) {
      if (v !== "" && !examples.includes(v)) examples.push(v.slice(0, 40));
      if (examples.length >= 3) break;
    }
    return {
      source: h,
      name: names[i],
      detected: inf.type,
      reason: inf.reason,
      precision: inf.precision,
      scale: inf.scale,
      maxLength: inf.maxLength,
      hasZone: inf.hasZone,
      empty: values.filter((v) => v === "").length,
      sampled: sample.length,
      examples,
    };
  });
}

/** A table name from the file name: "Customer Export (2026).csv" → customer_export_2026. */
export function tableFromFileName(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}
