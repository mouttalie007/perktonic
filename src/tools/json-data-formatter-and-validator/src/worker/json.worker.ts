/// <reference lib="webworker" />
import { formatJson, stats, treeChildren, type FormatOptions, type Stats, type TreeChild } from "../logic/format";
import { checkFile, decodeJsonBytes } from "../logic/input";
import { JsonSyntaxError, locate, parseJson, pointer, type Node, type ParseNotes } from "../logic/parser";
import { validateSchema, type Draft } from "../logic/schema";

export interface Located {
  message: string;
  line: number;
  column: number;
  pointer: string;
}

export type WorkerRequest =
  | { type: "parse"; jobId: number; source: { kind: "text"; text: string } | { kind: "file"; file: File }; lenient: boolean; format: FormatOptions }
  | { type: "format"; jobId: number; format: FormatOptions }
  | { type: "tree"; jobId: number; positions: number[]; steps: (string | number)[]; offset: number }
  | { type: "schema"; jobId: number; schema: string; draft: Draft; lenient: boolean };

export type WorkerResponse =
  | { type: "progress"; jobId: number; fraction: number | null; label: string }
  | { type: "parsed"; jobId: number; output: string; stats: Stats; notes: ParseNotes; duplicates: { key: string; line: number; column: number }[]; bytes: number }
  | { type: "invalid"; jobId: number; error: Located }
  | { type: "formatted"; jobId: number; output: string }
  | { type: "tree"; jobId: number; key: string; children: TreeChild[]; total: number; offset: number }
  | { type: "schema"; jobId: number; valid: boolean; draft: string; issues: (Located & { path: string; keyword: string })[] }
  | { type: "schemaInvalid"; jobId: number; error: Located }
  | { type: "error"; jobId: number; message: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;
let doc: { root: Node; src: string } | null = null;

class UserError extends Error {}

const post = (m: WorkerResponse) => ctx.postMessage(m);

function located(src: string, offset: number, message: string): Located {
  const l = locate(src, offset);
  return { message, line: l.line, column: l.column, pointer: pointer(l.lineText, l.column) };
}

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

ctx.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  try {
    if (req.type === "parse") {
      const src = req.source.kind === "text" ? req.source.text : await read(req.source.file, req.jobId);
      post({ type: "progress", jobId: req.jobId, fraction: null, label: "Parsing" });
      let parsed;
      try {
        parsed = parseJson(src, { lenient: req.lenient });
      } catch (e) {
        doc = null;
        if (e instanceof JsonSyntaxError) return post({ type: "invalid", jobId: req.jobId, error: located(src, e.offset, e.message) });
        if (e instanceof RangeError) throw new UserError("The JSON is nested too deeply (thousands of levels) to process in the browser.");
        throw e;
      }
      doc = { root: parsed.root, src };
      post({ type: "progress", jobId: req.jobId, fraction: null, label: "Formatting" });
      post({
        type: "parsed",
        jobId: req.jobId,
        output: formatJson(parsed.root, req.format),
        stats: stats(parsed.root),
        notes: parsed.notes,
        duplicates: parsed.notes.duplicateKeys.slice(0, 20).map((d) => ({ key: d.key, ...locate(src, d.at) })),
        bytes: new TextEncoder().encode(src).length,
      });
      return;
    }
    if (!doc) throw new UserError("Load valid JSON first.");
    if (req.type === "format") {
      post({ type: "formatted", jobId: req.jobId, output: formatJson(doc.root, req.format) });
    } else if (req.type === "tree") {
      const { children, total } = treeChildren(doc.root, req.positions, req.steps, req.offset);
      post({ type: "tree", jobId: req.jobId, key: req.positions.join("."), children, total, offset: req.offset });
    } else {
      let schemaNode: Node;
      try {
        schemaNode = parseJson(req.schema, { lenient: req.lenient }).root;
      } catch (e) {
        if (e instanceof JsonSyntaxError) return post({ type: "schemaInvalid", jobId: req.jobId, error: located(req.schema, e.offset, e.message) });
        throw e;
      }
      const res = validateSchema(doc.root, schemaNode, req.draft);
      post({ type: "schema", jobId: req.jobId, valid: res.valid, draft: res.draft, issues: res.issues.slice(0, 500).map((i) => ({ ...located(doc!.src, i.offset, i.message), path: i.path, keyword: i.keyword })) });
    }
  } catch (err) {
    const message =
      err instanceof UserError
        ? err.message
        : err instanceof RangeError
          ? "The browser ran out of memory for this JSON. Try a smaller file."
          : err instanceof Error && /schema/i.test(err.message)
            ? `The schema could not be used: ${err.message}`
            : "Something went wrong while processing the JSON.";
    post({ type: "error", jobId: req.jobId, message });
  }
};
