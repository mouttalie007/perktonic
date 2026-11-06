/// <reference lib="webworker" />
import { CsvStreamParser, detectDelimiter, type Delimiter } from "../logic/csvParser";
import { detectEncoding, ENCODING_LABELS, type EncodingId } from "../logic/encoding";
import { baseName } from "../logic/filenames";
import { MAX_FILE_BYTES, MAX_MERGE_BYTES, MAX_MERGE_FILES, MAX_PASTE_BYTES, type MergeOptions, type PartInfo, type SplitOptions } from "../logic/limits";
import { mapRow, planMerge, type MergePlan } from "../logic/merge";
import { rowToLine, SplitError, Splitter } from "../logic/split";
import { zipSink } from "../logic/zip";

export type Source = { kind: "text"; name: string; text: string } | { kind: "file"; file: File };

export type WorkerRequest =
  | { type: "inspect"; jobId: number; source: Source }
  | { type: "split"; jobId: number; source: Source; options: SplitOptions }
  | { type: "merge"; jobId: number; sources: Source[]; options: MergeOptions };

export interface Inspected {
  name: string;
  delimiter: Delimiter;
  encoding: string;
  header: string[];
  sample: string[][];
}

export type WorkerResponse =
  | { type: "progress"; jobId: number; fraction: number; label: string }
  | { type: "inspected"; jobId: number; info: Inspected }
  | { type: "split"; jobId: number; zip: Blob; parts: PartInfo[]; rows: number; oversizedRows: number; ms: number; info: Omit<Inspected, "sample"> }
  | { type: "merged"; jobId: number; file: Blob; name: string; rows: number; columns: string[]; report: (MergePlan["report"][number] & { rows: number; delimiter: string; encoding: string })[]; preview: string[]; ms: number; bytes: number }
  | { type: "error"; jobId: number; message: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const post = (m: WorkerResponse) => ctx.postMessage(m);
class UserError extends Error {}

const CHUNK = 1 << 20;
/** Output is gathered into Blobs of this size, so the browser can keep large results off the JS heap. */
const BLOB_BATCH = 16 << 20;

const nameOf = (s: Source) => (s.kind === "text" ? s.name : s.file.name);
const sizeOf = (s: Source) => (s.kind === "text" ? s.text.length : s.file.size);

async function head(s: Source, bytes = 65536): Promise<Uint8Array> {
  if (s.kind === "text") return new TextEncoder().encode(s.text.slice(0, bytes));
  return new Uint8Array(await s.file.slice(0, bytes).arrayBuffer());
}

/** Refuses files that are not CSV text, by their first bytes. */
function checkHead(h: Uint8Array, name: string, size: number) {
  const starts = (sig: number[]) => sig.every((b, i) => h[i] === b);
  if (size === 0) throw new UserError(`${name} is empty.`);
  if (starts([0x50, 0x4b, 0x03, 0x04])) throw new UserError(`${name} is an Excel (.xlsx) or ZIP file, not a CSV. Save it as CSV first.`);
  if (starts([0xd0, 0xcf, 0x11, 0xe0])) throw new UserError(`${name} is an old Excel (.xls) file. Save it as CSV first.`);
  if (starts([0x25, 0x50, 0x44, 0x46])) throw new UserError(`${name} is a PDF, not a CSV.`);
  if (starts([0x1f, 0x8b])) throw new UserError(`${name} is gzip-compressed. Decompress it first.`);
  const utf16 = starts([0xff, 0xfe]) || starts([0xfe, 0xff]);
  if (!utf16 && h.subarray(0, 8192).includes(0)) throw new UserError(`${name} contains binary data, so it is not a CSV.`);
}

function encodingOf(h: Uint8Array): EncodingId {
  // Drop the last bytes so a character cut in half does not look like invalid UTF-8.
  return detectEncoding(h.length >= 65536 ? h.subarray(0, h.length - 4) : h).encoding;
}

/** Decoded text in chunks, with progress measured in input bytes. */
async function* chunks(s: Source, encoding: EncodingId, onBytes: (n: number) => void): AsyncGenerator<string> {
  if (s.kind === "text") {
    for (let i = 0; i < s.text.length; i += CHUNK) {
      onBytes(Math.min(CHUNK, s.text.length - i));
      yield s.text.slice(i, i + CHUNK);
    }
    return;
  }
  const decoder = new TextDecoder(encoding);
  const reader = s.file.stream().getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    onBytes(value.length);
    yield decoder.decode(value, { stream: true });
  }
  const tail = decoder.decode();
  if (tail) yield tail;
}

async function inspect(s: Source): Promise<Inspected> {
  const h = await head(s, 262144);
  checkHead(h, nameOf(s), sizeOf(s));
  const encoding = s.kind === "text" ? "utf-8" : encodingOf(h);
  let text = s.kind === "text" ? s.text.slice(0, 262144) : new TextDecoder(encoding).decode(h);
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const delimiter = detectDelimiter(text);
  const p = new CsvStreamParser(delimiter);
  const rows = p.push(text);
  if (rows.length === 0) rows.push(...p.end());
  if (rows.length === 0) throw new UserError(`${nameOf(s)} has no rows.`);
  return { name: nameOf(s), delimiter, encoding: s.kind === "text" ? "UTF-8" : ENCODING_LABELS[encoding], header: rows[0], sample: rows.slice(1, 6) };
}

class BlobCollector {
  private blobs: Blob[] = [];
  private pending: Uint8Array[] = [];
  private pendingBytes = 0;
  total = 0;
  push(data: Uint8Array) {
    this.pending.push(data);
    this.pendingBytes += data.length;
    this.total += data.length;
    if (this.pendingBytes >= BLOB_BATCH) this.flush();
  }
  flush() {
    if (this.pending.length) this.blobs.push(new Blob(this.pending as BlobPart[]));
    this.pending = [];
    this.pendingBytes = 0;
  }
  blob(type: string): Blob {
    this.flush();
    return new Blob(this.blobs, { type });
  }
}

function progress(jobId: number, label: string, total: number) {
  let read = 0;
  let last = 0;
  return (n: number) => {
    read += n;
    const now = Date.now();
    if (now - last > 100) {
      last = now;
      post({ type: "progress", jobId, fraction: Math.min(1, read / Math.max(1, total)), label });
    }
  };
}

async function split(jobId: number, s: Source, options: SplitOptions) {
  const t0 = performance.now();
  if (s.kind === "file" && s.file.size > MAX_FILE_BYTES) throw new UserError(`${s.file.name} is ${(s.file.size / 1048576).toFixed(1)} MB. The limit for splitting is 50 MB.`);
  if (s.kind === "text" && new TextEncoder().encode(s.text).length > MAX_PASTE_BYTES) throw new UserError("The pasted text is larger than 5 MB. Save it as a .csv file and open it instead (up to 50 MB).");
  const info = await inspect(s);
  const encoding = s.kind === "text" ? "utf-8" : encodingOf(await head(s));
  const out = new BlobCollector();
  let finished = false;
  const sink = zipSink((data) => out.push(data), () => (finished = true));
  const splitter = new Splitter(options, info.delimiter, baseName(nameOf(s)), sink);
  const parser = new CsvStreamParser(info.delimiter);
  const onBytes = progress(jobId, "Splitting", sizeOf(s));
  let first = true;
  for await (let text of chunks(s, encoding, onBytes)) {
    if (first && text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    first = false;
    splitter.push(parser.push(text));
  }
  splitter.push(parser.end());
  const parts = splitter.finish();
  sink.end();
  if (!finished) throw new Error("zip not finished");
  post({ type: "split", jobId, zip: out.blob("application/zip"), parts, rows: splitter.rows, oversizedRows: splitter.oversizedRows, ms: Math.round(performance.now() - t0), info: { name: info.name, delimiter: info.delimiter, encoding: info.encoding, header: info.header } });
}

async function merge(jobId: number, sources: Source[], options: MergeOptions) {
  const t0 = performance.now();
  if (sources.length < 2) throw new UserError("Choose at least two CSV files to merge.");
  if (sources.length > MAX_MERGE_FILES) throw new UserError(`You chose ${sources.length} files; the limit is ${MAX_MERGE_FILES}.`);
  const total = sources.reduce((n, s) => n + sizeOf(s), 0);
  if (total > MAX_MERGE_BYTES) throw new UserError(`The files add up to ${(total / 1048576).toFixed(0)} MB; the limit is 500 MB.`);
  const infos: Inspected[] = [];
  const encodings: EncodingId[] = [];
  for (const s of sources) {
    infos.push(await inspect(s));
    encodings.push(s.kind === "text" ? "utf-8" : encodingOf(await head(s)));
  }
  const plan = planMerge(
    infos.map((i) => ({ name: i.name, header: i.header })),
    options,
  );
  const enc = new TextEncoder();
  const out = new BlobCollector();
  const d = options.delimiter;
  let pending: string[] = [];
  let pendingLen = 0;
  const emit = (line: string) => {
    pending.push(line);
    pendingLen += line.length;
    if (pendingLen >= 1 << 20) {
      out.push(enc.encode(pending.join("")));
      pending = [];
      pendingLen = 0;
    }
  };
  const preview: string[] = [];
  const headerLine = rowToLine(plan.columns, d);
  emit((options.bom ? "﻿" : "") + headerLine);
  preview.push(headerLine.slice(0, -2));
  const onBytes = progress(jobId, "Merging", total);
  let rows = 0;
  const perFile: number[] = [];
  for (let f = 0; f < sources.length; f++) {
    const parser = new CsvStreamParser(infos[f].delimiter);
    let skipHeader = true;
    let count = 0;
    const source = options.addSource ? infos[f].name : null;
    const take = (batch: string[][]) => {
      for (const row of batch) {
        if (skipHeader) {
          skipHeader = false;
          continue;
        }
        if (row.length === 1 && row[0] === "") continue;
        const line = rowToLine(mapRow(row, plan.maps[f], source), d);
        emit(line);
        if (preview.length < 9) preview.push(line.slice(0, -2));
        count++;
      }
    };
    let first = true;
    for await (let text of chunks(sources[f], encodings[f], onBytes)) {
      if (first && text.charCodeAt(0) === 0xfeff) text = text.slice(1);
      first = false;
      take(parser.push(text));
    }
    take(parser.end());
    perFile.push(count);
    rows += count;
  }
  if (pending.length) out.push(enc.encode(pending.join("")));
  const report = plan.report.map((r, i) => ({ ...r, rows: perFile[i], delimiter: infos[i].delimiter === "\t" ? "tab" : infos[i].delimiter, encoding: infos[i].encoding }));
  post({ type: "merged", jobId, file: out.blob("text/csv;charset=utf-8"), name: "merged.csv", rows, columns: plan.columns, report, preview, ms: Math.round(performance.now() - t0), bytes: out.total });
}

ctx.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  try {
    if (req.type === "inspect") post({ type: "inspected", jobId: req.jobId, info: await inspect(req.source) });
    else if (req.type === "split") await split(req.jobId, req.source, req.options);
    else await merge(req.jobId, req.sources, req.options);
  } catch (err) {
    const message = err instanceof UserError || err instanceof SplitError ? err.message : err instanceof RangeError ? "The browser ran out of memory. Try a smaller file or bigger parts." : "Something went wrong while reading the CSV.";
    post({ type: "error", jobId: req.jobId, message });
  }
};
