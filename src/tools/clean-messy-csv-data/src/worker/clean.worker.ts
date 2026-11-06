/// <reference lib="webworker" />
import { detectDelimiter, parseCsv, type Delimiter } from "../logic/csvParser";
import { toCsv } from "../logic/csvWriter";
import { decodeBytes, detectEncoding, ENCODING_LABELS, type EncodingChoice, type EncodingId } from "../logic/encoding";
import { cellToText, checkFile } from "../logic/input";
import { cleanTable, type CleanOptions, type CleanReport } from "../logic/pipeline";

export type Source = { kind: "text"; text: string } | { kind: "file"; file: File };

export type WorkerRequest = {
  type: "run";
  jobId: number;
  sourceId: number;
  source: Source;
  encoding: EncodingChoice;
  sheet: number;
  options: CleanOptions;
};

export interface SourceInfo {
  encoding: string | null;
  detectedEncoding: string | null;
  encodingReason: string | null;
  delimiter: Delimiter;
  sheets: string[];
  sheet: number;
}

export type WorkerResponse =
  | { type: "progress"; jobId: number; fraction: number | null; label: string }
  | {
      type: "result";
      jobId: number;
      csv: string;
      header: string[] | null;
      preview: string[][];
      previewRowNumbers: number[];
      columnIndexes: number[];
      report: CleanReport;
      info: SourceInfo;
    }
  | { type: "error"; jobId: number; message: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const PREVIEW_ROWS = 50;

class UserError extends Error {}

interface Loaded {
  key: string;
  sheets: { name: string; grid: string[][] }[];
  info: Omit<SourceInfo, "sheet">;
}
let cache: Loaded | null = null;

function post(msg: WorkerResponse) {
  ctx.postMessage(msg);
}

function parseText(text: string): { grid: string[][]; delimiter: Delimiter } {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const delimiter = detectDelimiter(clean);
  const { rows } = parseCsv(clean, delimiter);
  while (rows.length > 0 && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === "") rows.pop();
  return { grid: rows, delimiter };
}

async function load(req: WorkerRequest): Promise<Loaded> {
  const key = `${req.sourceId}|${req.encoding}`;
  if (cache && cache.key === key) return cache;
  if (req.source.kind === "text") {
    const { grid, delimiter } = parseText(req.source.text);
    return { key, sheets: [{ name: "Pasted data", grid }], info: { encoding: null, detectedEncoding: null, encodingReason: null, delimiter, sheets: ["Pasted data"] } };
  }
  const file = req.source.file;
  const head = new Uint8Array(await file.slice(0, 8192).arrayBuffer());
  const check = checkFile(head, file.size);
  if (!check.ok) throw new UserError(check.error);

  if (check.kind === "xlsx") {
    post({ type: "progress", jobId: req.jobId, fraction: null, label: "Opening workbook" });
    const { default: readXlsxFile } = await import("read-excel-file/web-worker");
    let sheets;
    try {
      sheets = await readXlsxFile(file);
    } catch {
      throw new UserError("This ZIP file is not a readable Excel workbook. Save it again as .xlsx, or export it to CSV.");
    }
    const parsed = sheets.map((s) => ({ name: s.sheet, grid: s.data.map((row) => row.map(cellToText)) }));
    return { key, sheets: parsed, info: { encoding: null, detectedEncoding: null, encodingReason: null, delimiter: ",", sheets: parsed.map((s) => s.name) } };
  }

  post({ type: "progress", jobId: req.jobId, fraction: null, label: "Reading file" });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const guess = detectEncoding(bytes);
  const encoding: EncodingId = req.encoding === "auto" ? guess.encoding : req.encoding;
  post({ type: "progress", jobId: req.jobId, fraction: null, label: "Parsing rows" });
  const { grid, delimiter } = parseText(decodeBytes(bytes, encoding));
  return {
    key,
    sheets: [{ name: file.name, grid }],
    info: {
      encoding: ENCODING_LABELS[encoding],
      detectedEncoding: ENCODING_LABELS[guess.encoding],
      encodingReason: guess.reason,
      delimiter,
      sheets: [file.name],
    },
  };
}

ctx.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  try {
    cache = await load(req);
    const sheet = Math.min(Math.max(0, req.sheet), cache.sheets.length - 1);
    const grid = cache.sheets[sheet].grid;
    if (grid.length === 0) throw new UserError("No rows found. Check that the file is a CSV or spreadsheet with data in it.");
    const result = cleanTable(grid, req.options, (fraction, label) => post({ type: "progress", jobId: req.jobId, fraction, label }));
    post({ type: "progress", jobId: req.jobId, fraction: 0.95, label: "Writing CSV" });
    const csv = toCsv(result.header, result.rows, cache.info.delimiter);
    post({
      type: "result",
      jobId: req.jobId,
      csv,
      header: result.header,
      preview: result.rows.slice(0, PREVIEW_ROWS),
      previewRowNumbers: result.rowNumbers.slice(0, PREVIEW_ROWS),
      columnIndexes: result.columnIndexes,
      report: result.report,
      info: { ...cache.info, sheet },
    });
  } catch (err) {
    const message =
      err instanceof UserError
        ? err.message
        : err instanceof RangeError
          ? "The browser ran out of memory for this file. Try a smaller file or split it first."
          : "Something went wrong while cleaning. Check that the input is a CSV or .xlsx file.";
    post({ type: "error", jobId: req.jobId, message });
  }
};
