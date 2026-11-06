/// <reference lib="webworker" />
import { CsvStreamParser, detectDelimiter, type Delimiter } from "../logic/csvParser";
import { toCsv } from "../logic/csvWriter";
import { decodeBytes, detectEncoding, ENCODING_LABELS } from "../logic/encoding";
import { cellToText, checkFile, MAX_PASTE_BYTES } from "../logic/input";
import { guard } from "../logic/guard";
import { applyRules, suggestRule } from "../logic/standardize";
import type { ColumnRule, ColumnStats, InvalidEntry, Options, Rule } from "../logic/types";

export type Source = { kind: "text"; text: string } | { kind: "file"; file: File };

export type WorkerRequest = { type: "load"; jobId: number; source: Source } | { type: "apply"; jobId: number; rules: ColumnRule[]; options: Options };

export interface Loaded {
  name: string;
  info: string;
  header: string[];
  rowCount: number;
  suggested: Rule[];
  sample: string[][];
}

export type WorkerResponse =
  | { type: "progress"; jobId: number; fraction: number; label: string }
  | { type: "loaded"; jobId: number; loaded: Loaded }
  | {
      type: "applied";
      jobId: number;
      stats: ColumnStats[];
      invalid: InvalidEntry[];
      invalidTotal: number;
      before: string[][];
      after: string[][];
      outHeader: string[];
      outIndex: number[];
      csv: Blob;
      invalidCsv: Blob;
      ms: number;
    }
  | { type: "error"; jobId: number; message: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const post = (m: WorkerResponse) => ctx.postMessage(m);
class UserError extends Error {}

let table: { header: string[]; rows: string[][]; name: string } | null = null;

function parseText(text: string, jobId: number): { header: string[]; rows: string[][]; delimiter: Delimiter } {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const delimiter = detectDelimiter(text);
  const parser = new CsvStreamParser(delimiter);
  const rows: string[][] = [];
  const step = 1 << 20;
  for (let i = 0; i < text.length; i += step) {
    for (const r of parser.push(text.slice(i, i + step))) rows.push(r);
    post({ type: "progress", jobId, fraction: Math.min(1, (i + step) / text.length) * 0.5, label: "Reading" });
  }
  for (const r of parser.end()) rows.push(r);
  const data = rows.filter((r) => !(r.length === 1 && r[0] === ""));
  if (data.length === 0) throw new UserError("The file has no rows.");
  return { header: data[0], rows: data.slice(1), delimiter };
}

async function load(jobId: number, s: Source): Promise<Loaded> {
  let header: string[];
  let rows: string[][];
  let info: string;
  let name = "pasted data";
  if (s.kind === "text") {
    if (new TextEncoder().encode(s.text).length > MAX_PASTE_BYTES) throw new UserError("The pasted text is larger than 5 MB. Save it as a .csv file and open it instead (up to 50 MB).");
    const p = parseText(s.text, jobId);
    ({ header, rows } = p);
    info = `${p.delimiter === "\t" ? "Tab" : `“${p.delimiter}”`}-separated text`;
  } else {
    name = s.file.name;
    const head = new Uint8Array(await s.file.slice(0, 8192).arrayBuffer());
    const check = checkFile(head, s.file.size);
    if (!check.ok) throw new UserError(check.error);
    if (check.kind === "xlsx") {
      const { default: readXlsxFile } = await import("read-excel-file/web-worker");
      let sheets;
      try {
        sheets = await readXlsxFile(s.file);
      } catch {
        throw new UserError("This file could not be read as an Excel workbook. If it is a Word or ZIP file, save the data as CSV or .xlsx.");
      }
      const grid = (sheets[0]?.data ?? []).map((r) => r.map(cellToText));
      if (grid.length === 0) throw new UserError("The first sheet of this workbook is empty.");
      header = grid[0];
      rows = grid.slice(1);
      info = `Excel workbook, sheet “${sheets[0].sheet}”${sheets.length > 1 ? ` (the first of ${sheets.length}; only the first sheet is used)` : ""}`;
    } else {
      const bytes = new Uint8Array(await s.file.arrayBuffer());
      const guess = detectEncoding(bytes);
      const p = parseText(decodeBytes(bytes, guess.encoding), jobId);
      ({ header, rows } = p);
      info = `${p.delimiter === "\t" ? "Tab" : `“${p.delimiter}”`}-separated, ${ENCODING_LABELS[guess.encoding]}`;
    }
  }
  if (rows.length === 0) throw new UserError("The file has a header but no data rows.");
  const width = Math.max(header.length, ...rows.slice(0, 1000).map((r) => r.length));
  while (header.length < width) header.push(`column_${header.length + 1}`);
  table = { header, rows, name };
  const suggested = header.map((h, i) => suggestRule(h, rows.slice(0, 200).map((r) => r[i] ?? "")));
  return { name, info, header, rowCount: rows.length, suggested, sample: rows.slice(0, 5) };
}

const invalidCsv = (list: InvalidEntry[]) => "﻿" + toCsv(["line", "column", "value", "reason"], list.map((e) => [String(e.row), e.column, guard(e.value), e.reason]), ",");

function apply(jobId: number, rules: ColumnRule[], options: Options) {
  if (!table) throw new UserError("Load a file first.");
  const t0 = performance.now();
  const n = table.rows.length;
  // Output rows are written into Blob parts as they are produced, about 4 MB of text at a time.
  const parts: BlobPart[] = [];
  let buf: string[] = [];
  let bufLen = 0;
  const flush = () => {
    if (buf.length) parts.push(new Blob([buf.join("")]));
    buf = [];
    bufLen = 0;
  };
  const onRow = (row: string[]) => {
    const line = toCsv(null, [row.map(guard)], ",");
    buf.push(line);
    bufLen += line.length;
    if (bufLen > 4 << 20) flush();
  };
  const res = applyRules(table.header, table.rows, rules, options, (done) => post({ type: "progress", jobId, fraction: done / n, label: "Standardising" }), onRow, 10);
  flush();
  const csv = new Blob([(options.bom ? "\uFEFF" : "") + toCsv(res.header, [], ","), ...parts], { type: "text/csv;charset=utf-8" });
  post({
    type: "applied",
    jobId,
    stats: res.stats,
    invalid: res.invalid.slice(0, 200),
    invalidTotal: res.invalidTotal,
    before: table.rows.slice(0, 10),
    after: res.rows.slice(0, 10),
    outHeader: res.header,
    outIndex: res.outIndex,
    csv,
    invalidCsv: new Blob([invalidCsv(res.invalid)], { type: "text/csv;charset=utf-8" }),
    ms: Math.round(performance.now() - t0),
  });
}

ctx.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  try {
    if (req.type === "load") post({ type: "loaded", jobId: req.jobId, loaded: await load(req.jobId, req.source) });
    else apply(req.jobId, req.rules, req.options);
  } catch (err) {
    const message = err instanceof UserError ? err.message : err instanceof RangeError ? "The browser ran out of memory for this file. Try a smaller file." : "Something went wrong while reading the file.";
    post({ type: "error", jobId: req.jobId, message });
  }
};
