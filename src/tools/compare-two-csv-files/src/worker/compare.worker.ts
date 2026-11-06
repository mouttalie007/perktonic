/// <reference lib="webworker" />
import { detectDelimiter, parseCsv } from "../logic/csvParser";
import { toCsv } from "../logic/csvWriter";
import { diffTables, joinTables, stackUnique, suggestKeys, type DiffResult, type JoinType, type MergeResult, type Table } from "../logic/diff";
import { decodeBytes, detectEncoding, ENCODING_LABELS, type EncodingChoice, type EncodingId } from "../logic/encoding";
import { checkFile, MAX_PASTE_BYTES } from "../logic/input";
import { groupCsv, type Group } from "../logic/report";

export type Side = "a" | "b";
export type Source = { kind: "text"; text: string } | { kind: "file"; file: File };

export interface RunOptions {
  mode: "compare" | "join" | "stack";
  keys: string[];
  ignoreCase: boolean;
  trim: boolean;
  trimValues: boolean;
  join: JoinType;
}

export type WorkerRequest =
  | { type: "load"; jobId: number; side: Side; source: Source; encoding: EncodingChoice }
  | { type: "run"; jobId: number; options: RunOptions }
  | { type: "export"; jobId: number; group: Group | "merged" };

export interface LoadedInfo {
  side: Side;
  headers: string[];
  rowCount: number;
  delimiter: string;
  encoding: string | null;
  ragged: number;
}

export interface ChangedRow {
  key: string[];
  cells: { column: string; old: string; new: string }[];
}

export type WorkerResponse =
  | { type: "progress"; jobId: number; fraction: number | null; label: string }
  | { type: "loaded"; jobId: number; info: LoadedInfo; suggested: string[] }
  | {
      type: "compared";
      jobId: number;
      counts: { added: number; removed: number; changed: number; unchanged: number };
      columns: { common: string[]; onlyA: string[]; onlyB: string[] };
      changed: ChangedRow[];
      added: { headers: string[]; rows: string[][] };
      removed: { headers: string[]; rows: string[][] };
      duplicates: { a: { key: string; count: number }[]; b: { key: string; count: number }[]; rowsA: number; rowsB: number };
      emptyKeys: number;
      keyLabels: string[];
      ms: number;
    }
  | { type: "merged"; jobId: number; headers: string[]; preview: string[][]; rowCount: number; multiplied: number; removedDuplicates: number; ms: number }
  | { type: "exported"; jobId: number; csv: string; name: string }
  | { type: "error"; jobId: number; message: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const post = (m: WorkerResponse) => ctx.postMessage(m);
const SHOWN = 200;

const tables: Partial<Record<Side, Table>> = {};
let last: { diff: DiffResult; keys: string[] } | null = null;
let merged: MergeResult | null = null;

async function load(req: Extract<WorkerRequest, { type: "load" }>): Promise<void> {
  let text: string;
  let encoding: string | null = null;
  if (req.source.kind === "file") {
    const f = req.source.file;
    const check = checkFile(new Uint8Array(await f.slice(0, 4096).arrayBuffer()), f.size);
    if (!check.ok) return post({ type: "error", jobId: req.jobId, message: `${req.side === "a" ? "File A" : "File B"}: ${check.error}` });
    post({ type: "progress", jobId: req.jobId, fraction: null, label: `Reading ${req.side === "a" ? "file A" : "file B"}` });
    const bytes = new Uint8Array(await f.arrayBuffer());
    const enc: EncodingId = req.encoding === "auto" ? detectEncoding(bytes).encoding : req.encoding;
    text = decodeBytes(bytes, enc);
    encoding = ENCODING_LABELS[enc];
  } else {
    text = req.source.text;
    if (new TextEncoder().encode(text).length > MAX_PASTE_BYTES) return post({ type: "error", jobId: req.jobId, message: "Pasted text is limited to 5 MB. Open larger data as a file (up to 50 MB)." });
  }
  post({ type: "progress", jobId: req.jobId, fraction: null, label: `Parsing ${req.side === "a" ? "file A" : "file B"}` });
  const clean = text.replace(/^﻿/, "");
  const delimiter = detectDelimiter(clean);
  const grid = parseCsv(clean, delimiter).rows.filter((r) => !(r.length === 1 && r[0] === ""));
  if (grid.length === 0) {
    delete tables[req.side];
    return post({ type: "error", jobId: req.jobId, message: `${req.side === "a" ? "File A" : "File B"} is empty.` });
  }
  const headers = grid[0].map((h, i) => h.trim() || `column_${i + 1}`);
  const rows = grid.slice(1);
  let ragged = 0;
  for (const r of rows) if (r.length !== headers.length) ragged++;
  tables[req.side] = { headers, rows };
  last = null;
  merged = null;
  const suggested = tables.a && tables.b ? suggestKeys(tables.a, tables.b) : [];
  post({ type: "loaded", jobId: req.jobId, info: { side: req.side, headers, rowCount: rows.length, delimiter, encoding, ragged }, suggested });
}

function run(req: Extract<WorkerRequest, { type: "run" }>): void {
  const a = tables.a;
  const b = tables.b;
  if (!a || !b) return post({ type: "error", jobId: req.jobId, message: "Add both files first." });
  const o = req.options;
  const t0 = performance.now();
  const progress = (fraction: number) => post({ type: "progress", jobId: req.jobId, fraction, label: o.mode === "compare" ? "Comparing rows" : "Merging" });
  if (o.mode === "compare") {
    let d: DiffResult;
    try {
      d = diffTables(a, b, { keys: o.keys, ignoreCase: o.ignoreCase, trim: o.trim, trimValues: o.trimValues }, progress);
    } catch (e) {
      return post({ type: "error", jobId: req.jobId, message: (e as Error).message });
    }
    last = { diff: d, keys: o.keys };
    const keyB = o.keys.map((k) => b.headers.findIndex((h) => h.trim().toLowerCase() === k.trim().toLowerCase()));
    const changed: ChangedRow[] = d.changed.slice(0, SHOWN).map((c) => ({
      key: o.keys.length ? keyB.map((i) => b.rows[c.b][i] ?? "") : [`row ${c.b + 2}`],
      cells: c.cols.map((idx) => {
        const [ia, ib, column] = d.columns.common[idx];
        return { column, old: a.rows[c.a][ia] ?? "", new: b.rows[c.b][ib] ?? "" };
      }),
    }));
    post({
      type: "compared",
      jobId: req.jobId,
      counts: { added: d.added.length, removed: d.removed.length, changed: d.changed.length, unchanged: d.unchanged },
      columns: { common: d.columns.common.map((c) => c[2]), onlyA: d.columns.onlyA, onlyB: d.columns.onlyB },
      changed,
      added: { headers: b.headers, rows: d.added.slice(0, SHOWN).map((j) => b.rows[j]) },
      removed: { headers: a.headers, rows: d.removed.slice(0, SHOWN).map((i) => a.rows[i]) },
      duplicates: { a: d.duplicatesA, b: d.duplicatesB, rowsA: d.duplicateRowsA, rowsB: d.duplicateRowsB },
      emptyKeys: d.emptyKeys,
      keyLabels: o.keys.length ? o.keys : ["Row"],
      ms: Math.round(performance.now() - t0),
    });
    return;
  }
  try {
    merged = o.mode === "join" ? joinTables(a, b, o.keys, o.join, o) : stackUnique(a, b, o.keys, o);
  } catch (e) {
    return post({ type: "error", jobId: req.jobId, message: (e as Error).message });
  }
  post({ type: "merged", jobId: req.jobId, headers: merged.headers, preview: merged.rows.slice(0, 50), rowCount: merged.rows.length, multiplied: merged.multiplied, removedDuplicates: merged.removedDuplicates, ms: Math.round(performance.now() - t0) });
}

function exportGroup(req: Extract<WorkerRequest, { type: "export" }>): void {
  if (req.group === "merged") {
    if (!merged) return post({ type: "error", jobId: req.jobId, message: "Run the merge first." });
    return post({ type: "exported", jobId: req.jobId, csv: toCsv(merged.headers, merged.rows, ","), name: "merged.csv" });
  }
  if (!last || !tables.a || !tables.b) return post({ type: "error", jobId: req.jobId, message: "Run the comparison first." });
  post({ type: "exported", jobId: req.jobId, csv: groupCsv(req.group, tables.a, tables.b, last.diff, last.keys), name: `${req.group}-rows.csv` });
}

// Messages are handled one after another, so a comparison sent right after a load waits for the file.
let queue: Promise<void> = Promise.resolve();

ctx.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const m = event.data;
  queue = queue.then(() => (m.type === "load" ? load(m) : m.type === "run" ? run(m) : exportGroup(m))).catch((e: unknown) => {
    post({ type: "error", jobId: m.jobId, message: e instanceof RangeError ? "The files are too large for this browser's memory. Try smaller files." : "Something went wrong while reading the files." });
  });
};
