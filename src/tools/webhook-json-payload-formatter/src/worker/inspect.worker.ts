/// <reference lib="webworker" />
import { formatJson, stats, summarize, treeChildren, type Indent, type Stats, type TreeChild } from "../logic/format";
import { checkFile, decodeJsonBytes } from "../logic/input";
import { JsonSyntaxError, locate, parseJson, pointer, type Node } from "../logic/parser";
import { inspect, type Inspection, type ProviderId } from "../logic/providers";
import { describeCounts, maskTree, type MaskCounts } from "../logic/redact";
import { keyFields, leafPathsCsv, type KeyField } from "../logic/paths";

export type Source = { kind: "text"; text: string } | { kind: "file"; file: File };
export type Choice = ProviderId | "auto" | "none";

export type WorkerRequest =
  | { type: "load"; jobId: number; source: Source; choice: Choice; mask: boolean; indent: Indent }
  | { type: "view"; jobId: number; choice: Choice; mask: boolean; indent: Indent }
  | { type: "tree"; jobId: number; positions: number[]; steps: (string | number)[]; offset: number }
  | { type: "paths"; jobId: number };

export interface Located {
  message: string;
  line: number;
  column: number;
  pointer: string;
  offset: number;
}

export type WorkerResponse =
  | { type: "progress"; jobId: number; fraction: number | null; label: string }
  | { type: "view"; jobId: number; output: string; stats: Stats; bytes: number; inspection: Inspection; keyFields: KeyField[]; masked: MaskCounts; maskedText: string; rootSummary: string; duplicates: number }
  | { type: "invalid"; jobId: number; error: Located }
  | { type: "tree"; jobId: number; key: string; children: TreeChild[]; total: number; offset: number }
  | { type: "paths"; jobId: number; csv: string; rows: number; capped: boolean }
  | { type: "error"; jobId: number; message: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const post = (m: WorkerResponse) => ctx.postMessage(m);

class UserError extends Error {}

let doc: { raw: Node; masked: Node; counts: MaskCounts; bytes: number; duplicates: number } | null = null;
let current: Node | null = null;

async function read(file: File, jobId: number): Promise<string> {
  const head = new Uint8Array(await file.slice(0, 8192).arrayBuffer());
  const check = checkFile(head, file.size);
  if (!check.ok) throw new UserError(check.error);
  const out = new Uint8Array(file.size);
  const reader = file.stream().getReader();
  let offset = 0;
  let last = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out.set(value, offset);
    offset += value.length;
    if (Date.now() - last > 100) {
      last = Date.now();
      post({ type: "progress", jobId, fraction: offset / file.size, label: "Reading file" });
    }
  }
  return decodeJsonBytes(out);
}

function view(jobId: number, choice: Choice, mask: boolean, indent: Indent) {
  if (!doc) throw new UserError("Paste a payload first.");
  current = mask ? doc.masked : doc.raw;
  // Checks always read the original values: masking must not turn a valid field into a warning.
  const inspection = inspect(doc.raw, choice);
  post({
    type: "view",
    jobId,
    output: formatJson(current, { indent, sortKeys: false }),
    stats: stats(current),
    bytes: doc.bytes,
    inspection,
    keyFields: keyFields(current, inspection.keyPaths),
    masked: doc.counts,
    maskedText: describeCounts(doc.counts),
    rootSummary: summarize(current),
    duplicates: doc.duplicates,
  });
}

ctx.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  try {
    if (req.type === "load") {
      const src = req.source.kind === "text" ? req.source.text : await read(req.source.file, req.jobId);
      if (src.trim() === "") throw new UserError("The payload is empty.");
      post({ type: "progress", jobId: req.jobId, fraction: null, label: "Parsing" });
      let root: Node;
      let duplicates = 0;
      try {
        const parsed = parseJson(src, { lenient: false });
        root = parsed.root;
        duplicates = parsed.notes.duplicateKeys.length;
      } catch (e) {
        doc = null;
        current = null;
        if (e instanceof JsonSyntaxError) {
          const l = locate(src, e.offset);
          return post({ type: "invalid", jobId: req.jobId, error: { message: e.message, line: l.line, column: l.column, pointer: pointer(l.lineText, l.column), offset: e.offset } });
        }
        if (e instanceof RangeError) throw new UserError("The JSON is nested too deeply (thousands of levels) to process in the browser.");
        throw e;
      }
      post({ type: "progress", jobId: req.jobId, fraction: null, label: "Masking and checking" });
      const { root: masked, counts } = maskTree(root);
      doc = { raw: root, masked, counts, bytes: new TextEncoder().encode(src).length, duplicates };
      view(req.jobId, req.choice, req.mask, req.indent);
    } else if (req.type === "view") {
      view(req.jobId, req.choice, req.mask, req.indent);
    } else if (req.type === "tree") {
      if (!current) throw new UserError("Paste a payload first.");
      const { children, total } = treeChildren(current, req.positions, req.steps, req.offset);
      post({ type: "tree", jobId: req.jobId, key: req.positions.join("."), children, total, offset: req.offset });
    } else {
      if (!current) throw new UserError("Paste a payload first.");
      const res = leafPathsCsv(current);
      post({ type: "paths", jobId: req.jobId, ...res });
    }
  } catch (err) {
    const message = err instanceof UserError ? err.message : err instanceof RangeError ? "The browser ran out of memory for this payload. Try a smaller file." : "Something went wrong while reading the payload.";
    post({ type: "error", jobId: req.jobId, message });
  }
};

