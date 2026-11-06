import type { Jq } from "jq-wasm";
import type { JSONPath as JSONPathFn } from "jsonpath-plus";
import { checkFile, decodeJsonBytes, describeValue, parseJson, type Located } from "../logic/input";
import { MAX_PASTE_BYTES } from "../logic/limits";
import { runJq, runJsonPath, type JqOptions, type Language, type QueryResult } from "../logic/run";

export type WorkerRequest =
  | { type: "load"; jobId: number; source: { kind: "text"; text: string } | { kind: "file"; file: File } }
  | { type: "query"; jobId: number; language: Language; expression: string; options: JqOptions };

export type WorkerResponse =
  | { type: "loaded"; jobId: number; bytes: number; summary: string; name: string | null }
  | { type: "invalid"; jobId: number; error: Located }
  | { type: "progress"; jobId: number; label: string }
  | { type: "result"; jobId: number; result: QueryResult; ms: number }
  | { type: "error"; jobId: number; message: string };

// The document lives here so each query only sends the expression, not up to 50 MB of text.
let docText: string | null = null;
let docValue: unknown = undefined;
let jqPromise: Promise<Jq> | null = null;
let jsonPathFn: typeof JSONPathFn | null = null;

const post = (m: WorkerResponse) => (self as unknown as Worker).postMessage(m);

async function load(jobId: number, source: Extract<WorkerRequest, { type: "load" }>["source"]): Promise<void> {
  docText = null;
  docValue = undefined;
  let text: string;
  let bytes: number;
  let name: string | null = null;
  if (source.kind === "file") {
    const head = new Uint8Array(await source.file.slice(0, 4096).arrayBuffer());
    const check = checkFile(head, source.file.size);
    if (!check.ok) return post({ type: "error", jobId, message: check.error });
    post({ type: "progress", jobId, label: "Reading the file" });
    const all = new Uint8Array(await source.file.arrayBuffer());
    try {
      text = decodeJsonBytes(all);
    } catch {
      return post({ type: "error", jobId, message: "This file is not valid UTF-8 or UTF-16 text." });
    }
    bytes = source.file.size;
    name = source.file.name;
  } else {
    text = source.text;
    bytes = new TextEncoder().encode(text).length;
    if (bytes > MAX_PASTE_BYTES) return post({ type: "error", jobId, message: "The pasted text is larger than 5 MB. Save it as a .json file and open it instead (up to 50 MB)." });
  }
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  post({ type: "progress", jobId, label: "Parsing the JSON" });
  const parsed = parseJson(text);
  if (!parsed.ok) return post({ type: "invalid", jobId, error: parsed.error });
  docText = text;
  docValue = parsed.value;
  post({ type: "loaded", jobId, bytes, summary: describeValue(parsed.value), name });
}

async function query(jobId: number, language: Language, expression: string, options: JqOptions): Promise<void> {
  if (docText === null) return post({ type: "error", jobId, message: "Paste or open some JSON first." });
  const start = performance.now();
  let result: QueryResult;
  if (language === "jsonpath") {
    if (!jsonPathFn) {
      post({ type: "progress", jobId, label: "Loading JSONPath" });
      jsonPathFn = (await import("jsonpath-plus")).JSONPath;
    }
    post({ type: "progress", jobId, label: "Running the query" });
    result = runJsonPath(jsonPathFn, docValue, expression, options.compact);
  } else {
    if (!jqPromise) {
      post({ type: "progress", jobId, label: "Loading jq (WebAssembly, about 330 KB)" });
      jqPromise = import("jq-wasm").then((m) => m.loadJq());
      jqPromise.catch(() => {
        jqPromise = null;
      });
    }
    const jq = await jqPromise;
    post({ type: "progress", jobId, label: "Running jq" });
    result = runJq(jq, docText, expression, options);
  }
  post({ type: "result", jobId, result, ms: Math.round(performance.now() - start) });
}

// Messages run one after another, so a query sent right after a load waits for the document.
let queue: Promise<void> = Promise.resolve();

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const m = event.data;
  queue = queue.then(() => (m.type === "load" ? load(m.jobId, m.source) : query(m.jobId, m.language, m.expression, m.options))).catch((e: unknown) => {
    const msg = e instanceof Error && /memory|allocation/i.test(e.message) ? "The browser ran out of memory. Try a smaller document or a narrower query." : m.type === "query" && m.language === "jq" ? "jq could not be started in this browser." : "Something went wrong while reading the JSON.";
    post({ type: "error", jobId: m.jobId, message: msg });
  });
};
