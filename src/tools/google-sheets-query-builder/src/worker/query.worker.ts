/// <reference lib="webworker" />
import { buildTable, MAX_FILE_BYTES, parseGrid, type Column, type Table, type TableOptions } from "../logic/data";
import { runQuery } from "../logic/evaluate";
import { QueryError } from "../logic/query";
import { formatValue } from "../logic/values";

export type WorkerRequest =
  | { type: "load"; jobId: number; source: { kind: "text"; text: string } | { kind: "file"; file: File }; options: TableOptions }
  | { type: "run"; jobId: number; query: string; previewRows: number }
  | { type: "csv"; jobId: number; query: string };

export type WorkerResponse =
  | { type: "loaded"; jobId: number; columns: Column[]; rowCount: number }
  | { type: "result"; jobId: number; headers: string[]; rows: string[][]; totalRows: number; ignored: string[] }
  | { type: "csv"; jobId: number; csv: string }
  | { type: "error"; jobId: number; message: string; stage: "load" | "run" };

const ctx = self as unknown as DedicatedWorkerGlobalScope;
let table: Table | null = null;

class UserError extends Error {}

async function readFile(file: File): Promise<string> {
  if (file.size === 0) throw new UserError("This file is empty.");
  if (file.size > MAX_FILE_BYTES) throw new UserError(`This file is ${(file.size / 1048576).toFixed(1)} MB; the limit is 50 MB.`);
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const starts = (sig: number[]) => sig.every((b, i) => head[i] === b);
  if (starts([0x50, 0x4b, 0x03, 0x04])) throw new UserError("This is an Excel or ZIP file. In your spreadsheet, choose File → Download → CSV, or copy the cells and paste them here.");
  if (starts([0x25, 0x50, 0x44, 0x46]) || starts([0xd0, 0xcf, 0x11, 0xe0]) || starts([0x89, 0x50, 0x4e, 0x47])) throw new UserError("This is not a CSV or TSV text file.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.subarray(0, 8192).includes(0)) throw new UserError("This file contains binary data, so it is not a CSV or TSV file.");
  return new TextDecoder("utf-8").decode(bytes);
}

const q = (s: string) => (/[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

ctx.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  try {
    if (req.type === "load") {
      const text = req.source.kind === "text" ? req.source.text : await readFile(req.source.file);
      const grid = parseGrid(text);
      if (grid.length === 0) throw new UserError("No rows found. Paste cells copied from a sheet, or a CSV/TSV file.");
      table = buildTable(grid, req.options);
      ctx.postMessage({ type: "loaded", jobId: req.jobId, columns: table.columns, rowCount: table.rows.length } satisfies WorkerResponse);
      return;
    }
    if (!table) throw new UserError("Load some data first.");
    const result = runQuery(table, req.query);
    if (req.type === "run") {
      ctx.postMessage({ type: "result", jobId: req.jobId, headers: result.headers, rows: result.rows.slice(0, req.previewRows).map((r) => r.map(formatValue)), totalRows: result.totalRows, ignored: result.ignored } satisfies WorkerResponse);
    } else {
      const lines = [result.headers.map(q).join(","), ...result.rows.map((r) => r.map((v) => q(formatValue(v))).join(","))];
      ctx.postMessage({ type: "csv", jobId: req.jobId, csv: lines.join("\r\n") + "\r\n" } satisfies WorkerResponse);
    }
  } catch (err) {
    const message = err instanceof UserError || err instanceof QueryError || (err instanceof Error && err.message.startsWith("The data has")) ? err.message : "Something went wrong while running the preview.";
    ctx.postMessage({ type: "error", jobId: req.jobId, message, stage: req.type === "load" ? "load" : "run" } satisfies WorkerResponse);
  }
};
