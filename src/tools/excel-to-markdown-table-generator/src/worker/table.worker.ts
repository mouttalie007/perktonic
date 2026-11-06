/// <reference lib="webworker" />
import { parseAuto } from "../logic/csv";
import { convertGrid, type ConvertOptions } from "../logic/convert";
import { cellToText, decodeText, sniffFile } from "../logic/input";
import type { Align } from "../logic/table";

export type Source = { kind: "text"; text: string } | { kind: "file"; file: File };

export type WorkerRequest = {
  type: "run";
  jobId: number;
  sourceId: number;
  source: Source;
  sheet: number;
  options: ConvertOptions;
};

export type WorkerResponse =
  | { type: "progress"; jobId: number; fraction: number | null; label: string }
  | {
      type: "result";
      jobId: number;
      text: string;
      warnings: string[];
      header: string[] | null;
      preview: string[][];
      aligns: Align[];
      rowCount: number;
      columnCount: number;
      sheets: string[];
      sheet: number;
      info: string;
    }
  | { type: "error"; jobId: number; message: string };

const PREVIEW_ROWS = 100;
const ctx = self as unknown as DedicatedWorkerGlobalScope;

interface Loaded {
  sourceId: number;
  sheets: { name: string; grid: string[][] }[];
  info: string;
  warnings: string[];
}
let cache: Loaded | null = null;

function post(msg: WorkerResponse) {
  ctx.postMessage(msg);
}

async function readAll(file: File, jobId: number): Promise<Uint8Array> {
  const out = new Uint8Array(file.size);
  const reader = file.stream().getReader();
  let offset = 0;
  let lastReport = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out.set(value, offset);
    offset += value.length;
    const now = Date.now();
    if (now - lastReport > 100) {
      lastReport = now;
      post({ type: "progress", jobId, fraction: offset / file.size, label: "Reading file" });
    }
  }
  return out;
}

async function load(source: Source, sourceId: number, jobId: number): Promise<Loaded> {
  if (source.kind === "text") {
    const parsed = parseAuto(source.text);
    const warnings = parsed.unclosedQuote ? ["A quoted cell was never closed, so the last cell runs to the end of the text."] : [];
    const name = parsed.delimiter === "\t" ? "tab" : `"${parsed.delimiter}"`;
    return { sourceId, sheets: [{ name: "Pasted data", grid: parsed.rows }], info: `Separator: ${name}`, warnings };
  }
  const head = new Uint8Array(await source.file.slice(0, 8192).arrayBuffer());
  const sniff = sniffFile(head, source.file.size);
  if (!sniff.ok) throw new Error(sniff.error);

  if (sniff.kind === "xlsx") {
    post({ type: "progress", jobId, fraction: null, label: "Opening workbook" });
    const { default: readXlsxFile } = await import("read-excel-file/web-worker");
    let sheets;
    try {
      sheets = await readXlsxFile(source.file);
    } catch {
      throw new Error("This ZIP file could not be read as an Excel workbook. Save it again as .xlsx, or export it to CSV.");
    }
    return {
      sourceId,
      sheets: sheets.map((s) => ({ name: s.sheet, grid: s.data.map((row) => row.map(cellToText)) })),
      info: `Workbook with ${sheets.length} sheet(s)`,
      warnings: [],
    };
  }

  const bytes = await readAll(source.file, jobId);
  post({ type: "progress", jobId, fraction: null, label: "Parsing rows" });
  const { text, encoding } = decodeText(bytes);
  const parsed = parseAuto(text);
  const warnings: string[] = [];
  if (encoding === "Windows-1252") warnings.push("The file is not valid UTF-8, so it was read as Windows-1252. Check accented characters.");
  if (parsed.unclosedQuote) warnings.push("A quoted cell was never closed, so the last cell runs to the end of the file.");
  const name = parsed.delimiter === "\t" ? "tab" : `"${parsed.delimiter}"`;
  return {
    sourceId,
    sheets: [{ name: source.file.name, grid: parsed.rows }],
    info: `${encoding}, separator: ${name}`,
    warnings,
  };
}

ctx.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  if (req.type !== "run") return;
  try {
    if (!cache || cache.sourceId !== req.sourceId) cache = await load(req.source, req.sourceId, req.jobId);
    const sheetIndex = Math.min(Math.max(0, req.sheet), cache.sheets.length - 1);
    const grid = cache.sheets[sheetIndex]?.grid ?? [];
    if (grid.length === 0) throw new Error("This sheet is empty. Pick another sheet or check the file.");
    post({ type: "progress", jobId: req.jobId, fraction: null, label: "Writing table" });
    const result = convertGrid(grid, req.options);
    if (!result.ok) throw new Error(result.error);
    post({
      type: "result",
      jobId: req.jobId,
      text: result.text,
      warnings: [...cache.warnings, ...result.warnings],
      header: result.table.header,
      preview: result.table.rows.slice(0, PREVIEW_ROWS),
      aligns: result.aligns,
      rowCount: result.table.rows.length,
      columnCount: result.table.columnCount,
      sheets: cache.sheets.map((s) => s.name),
      sheet: sheetIndex,
      info: cache.info,
    });
  } catch (err) {
    // Built-in errors (TypeError, RangeError...) are bugs or corrupt input, not messages written for people.
    const friendly = err instanceof Error && err.constructor === Error;
    const message = friendly ? (err as Error).message : "Something went wrong while reading the data. Try exporting it again as CSV.";
    post({ type: "error", jobId: req.jobId, message });
  }
};
