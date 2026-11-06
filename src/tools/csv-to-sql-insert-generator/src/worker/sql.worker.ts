/// <reference lib="webworker" />
import { decodeBytes, detectEncoding, ENCODING_LABELS, type EncodingChoice, type EncodingId } from "../logic/encoding";
import { checkFile } from "../logic/input";
import { MAX_PASTE_BYTES } from "../logic/limits";
import { safeName } from "../logic/names";
import { generate, type Problem } from "../logic/sql";
import { analyzeColumns, readTable, type Table } from "../logic/table";
import type { ColumnInfo, ColumnType, Options } from "../logic/types";

export type Source = { kind: "text"; text: string } | { kind: "file"; file: File };

export type WorkerRequest =
  | { type: "analyze"; jobId: number; source: Source; encoding: EncodingChoice; hasHeader: boolean; dialect: Options["dialect"] }
  | { type: "generate"; jobId: number; options: Options; types: ColumnType[]; names: string[] };

export type WorkerResponse =
  | { type: "progress"; jobId: number; fraction: number | null; label: string }
  | {
      type: "analyzed";
      jobId: number;
      columns: ColumnInfo[];
      rowCount: number;
      preview: string[][];
      delimiter: string;
      encoding: string | null;
      encodingReason: string | null;
      warnings: string[];
    }
  | { type: "generated"; jobId: number; sql: string; problems: Problem[]; rowCount: number; statements: number }
  | { type: "error"; jobId: number; message: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;
let table: Table | null = null;
let columns: ColumnInfo[] = [];

const post = (m: WorkerResponse) => ctx.postMessage(m);

async function analyze(req: Extract<WorkerRequest, { type: "analyze" }>) {
  let text: string;
  let encoding: string | null = null;
  let encodingReason: string | null = null;
  if (req.source.kind === "file") {
    const file = req.source.file;
    const check = checkFile(new Uint8Array(await file.slice(0, 4096).arrayBuffer()), file.size);
    if (!check.ok) return post({ type: "error", jobId: req.jobId, message: check.error });
    post({ type: "progress", jobId: req.jobId, fraction: null, label: "Reading the file" });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const guess = detectEncoding(bytes);
    const enc: EncodingId = req.encoding === "auto" ? guess.encoding : req.encoding;
    text = decodeBytes(bytes, enc);
    encoding = ENCODING_LABELS[enc];
    encodingReason = req.encoding === "auto" ? `detected: ${guess.reason}` : "chosen by you";
  } else {
    text = req.source.text;
    if (new TextEncoder().encode(text).length > MAX_PASTE_BYTES) return post({ type: "error", jobId: req.jobId, message: "The pasted text is larger than 5 MB. Save it as a .csv file and open it instead (up to 50 MB)." });
  }
  if (text.trim() === "") return post({ type: "error", jobId: req.jobId, message: "The CSV is empty." });
  post({ type: "progress", jobId: req.jobId, fraction: null, label: "Parsing rows" });
  table = readTable(text, req.hasHeader);
  if (table.headers.length === 0) return post({ type: "error", jobId: req.jobId, message: "No columns were found in this CSV." });
  if (req.hasHeader && table.rows.length === 0) return post({ type: "error", jobId: req.jobId, message: "The CSV has a header but no data rows. Untick “First row is a header” if the first row is data." });
  post({ type: "progress", jobId: req.jobId, fraction: null, label: "Detecting column types" });
  columns = analyzeColumns(table, req.dialect);
  const warnings: string[] = [];
  if (table.unclosedQuote) warnings.push("A quoted field is never closed, so the rest of the file was read as one value. Check for a stray \" in the data.");
  if (table.ragged) warnings.push(`${table.ragged.toLocaleString("en-US")} row${table.ragged === 1 ? " has" : "s have"} a different number of cells than the header; missing cells are treated as empty and extra cells are ignored.`);
  if (table.rows.length > 10_000) warnings.push(`Types were detected from the first 10,000 of ${table.rows.length.toLocaleString("en-US")} rows; every row is still checked when the SQL is written.`);
  post({ type: "analyzed", jobId: req.jobId, columns, rowCount: table.rows.length, preview: table.rows.slice(0, 5), delimiter: table.delimiter, encoding, encodingReason, warnings });
}

function run(req: Extract<WorkerRequest, { type: "generate" }>) {
  if (!table) return post({ type: "error", jobId: req.jobId, message: "Load a CSV first." });
  const t = table;
  const options: Options = { ...req.options, table: safeName(req.options.table, "imported_data", req.options.dialect) };
  const plan = {
    options,
    columns: columns.map((c, i) => ({ name: safeName(req.names[i] ?? c.name, c.name, options.dialect), type: req.types[i] ?? c.detected, info: c })),
  };
  // Names edited by the visitor can collide; keep them unique.
  const seen = new Set<string>();
  for (const c of plan.columns) {
    let name = c.name;
    for (let k = 2; seen.has(name); k++) name = `${c.name}_${k}`;
    seen.add(name);
    c.name = name;
  }
  const out = generate(plan, t.rows, (done) => post({ type: "progress", jobId: req.jobId, fraction: done / t.rows.length, label: `Writing rows: ${done.toLocaleString("en-US")} of ${t.rows.length.toLocaleString("en-US")}` }));
  const statements = (out.sql.match(/;\n/g) ?? []).length;
  post({ type: "generated", jobId: req.jobId, sql: out.sql, problems: out.problems, rowCount: t.rows.length, statements });
}

ctx.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const m = event.data;
  const job = m.type === "analyze" ? analyze(m) : Promise.resolve(run(m));
  job.catch((e: unknown) => {
    const msg = e instanceof RangeError ? "The file is too large for this browser's memory. Try a smaller file." : "Something went wrong while reading the CSV.";
    post({ type: "error", jobId: m.jobId, message: msg });
  });
};
