/// <reference lib="webworker" />
import { CsvToJsonStream, type CsvToJsonOptions, type CsvToJsonSummary } from "../logic/csvToJson";
import { checkFile, detectEncoding, type EncodingId } from "../logic/input";
import { parseJsonRecords, recordsToCsv, type JsonToCsvOptions } from "../logic/jsonToCsv";
import type { JsonValue } from "../logic/values";

export type Direction = "csv2json" | "json2csv";
export type Source = { kind: "text"; text: string } | { kind: "file"; file: File };

export type WorkerRequest = {
  type: "run";
  jobId: number;
  source: Source;
  direction: Direction;
  encoding: EncodingId;
  csv: CsvToJsonOptions;
  json: JsonToCsvOptions;
};

export type WorkerResponse =
  | { type: "progress"; jobId: number; fraction: number | null; label: string }
  | {
      type: "result";
      jobId: number;
      blob: Blob;
      previewText: string;
      truncated: boolean;
      columns: string[];
      rows: string[][];
      rowCount: number;
      warnings: string[];
      info: string;
    }
  | { type: "error"; jobId: number; message: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const PREVIEW_CHARS = 100_000;
const FLUSH_CHARS = 8 * 1024 * 1024;

class UserError extends Error {}

function post(msg: WorkerResponse) {
  ctx.postMessage(msg);
}

/** Collects output text, moving it into Blob parts every 8 MB so huge results do not pile up as strings. */
class OutputSink {
  private strings: string[] = [];
  private stringChars = 0;
  private blobs: Blob[] = [];
  preview = "";
  totalChars = 0;

  constructor(private readonly type: string) {}

  write = (s: string) => {
    if (this.preview.length < PREVIEW_CHARS) this.preview += s.slice(0, PREVIEW_CHARS - this.preview.length);
    this.strings.push(s);
    this.stringChars += s.length;
    this.totalChars += s.length;
    if (this.stringChars >= FLUSH_CHARS) this.flush();
  };

  private flush() {
    if (this.strings.length === 0) return;
    this.blobs.push(new Blob(this.strings));
    this.strings = [];
    this.stringChars = 0;
  }

  finish(): Blob {
    this.flush();
    return new Blob(this.blobs, { type: this.type });
  }
}

function previewFromRecords(records: JsonValue[]): { columns: string[]; rows: string[][] } {
  const columns: string[] = [];
  for (const r of records) {
    if (r && typeof r === "object" && !Array.isArray(r)) {
      for (const k of Object.keys(r)) if (!columns.includes(k)) columns.push(k);
    }
  }
  const show = (v: JsonValue | undefined) => (v === undefined ? "" : typeof v === "string" ? v : JSON.stringify(v));
  if (columns.length === 0) {
    const rows = records.map((r) => (Array.isArray(r) ? r.map(show) : [show(r)]));
    const width = Math.max(0, ...rows.map((r) => r.length));
    return { columns: Array.from({ length: width }, (_, i) => `[${i}]`), rows };
  }
  return { columns, rows: records.map((r) => columns.map((c) => show((r as Record<string, JsonValue>)[c]))) };
}

function csvWarnings(s: CsvToJsonSummary): string[] {
  const w: string[] = [];
  if (s.headerFixes.length > 0) {
    const list = s.headerFixes.slice(0, 5).map((f) => `"${f.from}" → "${f.to}"`).join(", ");
    w.push(`Renamed ${s.headerFixes.length} empty or duplicate header(s): ${list}${s.headerFixes.length > 5 ? ", …" : ""}.`);
  }
  if (s.raggedRows > 0) w.push(`${s.raggedRows} row(s) had a different number of cells than the header; missing cells became empty and extra cells got column_N keys.`);
  if (s.conflicts.length > 0) w.push(`Could not nest ${s.conflicts.length} key(s) because a parent key already holds a value: ${s.conflicts.slice(0, 3).join(", ")}. They were kept flat.`);
  if (s.unclosedQuote) w.push("A quoted field is never closed, so the last value runs to the end of the file. Check for a stray \" character.");
  return w;
}

const DELIM_NAMES: Record<string, string> = { ",": "comma", ";": "semicolon", "\t": "tab", "|": "pipe" };

async function runCsvToJson(req: WorkerRequest): Promise<WorkerResponse> {
  const sink = new OutputSink(req.csv.output === "ndjson" ? "application/x-ndjson" : "application/json");
  const stream = new CsvToJsonStream(req.csv, sink.write);
  let encodingLabel = "pasted text";

  if (req.source.kind === "text") {
    stream.push(req.source.text);
  } else {
    const file = req.source.file;
    const head = new Uint8Array(await file.slice(0, 65536).arrayBuffer());
    const detected = detectEncoding(head);
    const encoding = req.encoding === "auto" ? detected.encoding : req.encoding;
    const check = checkFile(head, file.size, new TextDecoder(encoding).decode(head.subarray(0, 1024)));
    if (!check.ok) throw new UserError(check.error);
    encodingLabel = encoding.toUpperCase();
    const decoder = new TextDecoder(encoding);
    const reader = file.stream().getReader();
    let read = 0;
    let last = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      read += value.length;
      stream.push(decoder.decode(value, { stream: true }));
      const now = Date.now();
      if (now - last > 100) {
        last = now;
        post({ type: "progress", jobId: req.jobId, fraction: read / file.size, label: `Converting… ${(read / 1048576).toFixed(0)} of ${(file.size / 1048576).toFixed(0)} MB` });
      }
    }
    stream.push(decoder.decode());
  }
  const summary = stream.end();
  if (summary.rows === 0) {
    throw new UserError(req.csv.hasHeader ? "Only a header row was found, so there are no records to convert." : "No rows found in the CSV.");
  }
  const blob = sink.finish();
  const preview = previewFromRecords(summary.preview);
  const warnings = csvWarnings(summary);
  if (sink.preview.includes("�")) warnings.push("Some characters could not be decoded. Pick the file's encoding under Options.");
  return {
    type: "result",
    jobId: req.jobId,
    blob,
    previewText: sink.preview,
    truncated: sink.totalChars > sink.preview.length,
    columns: preview.columns,
    rows: preview.rows,
    rowCount: summary.rows,
    warnings,
    info: `${summary.rows.toLocaleString("en-US")} record(s), ${DELIM_NAMES[summary.delimiter]} separated, ${encodingLabel}`,
  };
}

async function runJsonToCsv(req: WorkerRequest): Promise<WorkerResponse> {
  let text: string;
  if (req.source.kind === "text") {
    text = req.source.text;
  } else {
    const file = req.source.file;
    const head = new Uint8Array(await file.slice(0, 8192).arrayBuffer());
    const detected = detectEncoding(head);
    const encoding = req.encoding === "auto" ? detected.encoding : req.encoding;
    const check = checkFile(head, file.size, new TextDecoder(encoding).decode(head.subarray(0, 1024)));
    if (!check.ok) throw new UserError(check.error);
    post({ type: "progress", jobId: req.jobId, fraction: null, label: "Reading JSON" });
    text = new TextDecoder(encoding).decode(await file.arrayBuffer());
  }
  post({ type: "progress", jobId: req.jobId, fraction: null, label: "Parsing JSON" });
  const parsed = parseJsonRecords(text);
  if (!parsed.ok) throw new UserError(parsed.error);
  if (parsed.records.length === 0) throw new UserError("The JSON array is empty, so there is nothing to convert.");
  post({ type: "progress", jobId: req.jobId, fraction: null, label: "Writing CSV" });
  const out = recordsToCsv(parsed.records, req.json);
  const body = out.csv;
  const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
  const header = req.json.includeHeader && out.preview.length > 0 ? out.preview[0] : out.columns;
  const rows = req.json.includeHeader ? out.preview.slice(1) : out.preview;
  const warnings: string[] = [];
  if (parsed.note) warnings.push(parsed.note);
  if (out.columns.length > 500) warnings.push(`The CSV has ${out.columns.length} columns. Spreadsheets handle this, but consider turning off flattening for arrays.`);
  return {
    type: "result",
    jobId: req.jobId,
    blob,
    previewText: body.slice(0, PREVIEW_CHARS),
    truncated: body.length > PREVIEW_CHARS,
    columns: header,
    rows,
    rowCount: out.rows,
    warnings,
    info: `${out.rows.toLocaleString("en-US")} row(s), ${out.columns.length} column(s)`,
  };
}

ctx.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  try {
    const res = req.direction === "csv2json" ? await runCsvToJson(req) : await runJsonToCsv(req);
    post(res);
  } catch (err) {
    const message =
      err instanceof UserError
        ? err.message
        : err instanceof RangeError
          ? "The browser ran out of memory for this file. Try a smaller file or turn off pretty printing."
          : "Something went wrong while converting. Check that the input is CSV or JSON text.";
    post({ type: "error", jobId: req.jobId, message });
  }
};
