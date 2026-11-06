/// <reference lib="webworker" />
import { customMatches, extractAll } from "../logic/extract";
import { MAX_PASTE_BYTES, type Category, type Entity, type Options } from "../logic/types";

export type Source = { kind: "text"; text: string } | { kind: "file"; file: File };
export type WorkerRequest =
  | { type: "extract"; jobId: number; source: Source; options: Options }
  | { type: "custom"; jobId: number; source: Source; pattern: string; flags: string; dedupe: boolean };
export type WorkerResponse =
  | { type: "progress"; jobId: number; label: string; fraction: number }
  | { type: "extracted"; jobId: number; result: Record<Category, Entity[]>; chars: number; ms: number }
  | { type: "custom"; jobId: number; result: Entity[]; ms: number }
  | { type: "error"; jobId: number; message: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const post = (m: WorkerResponse) => ctx.postMessage(m);
let cached: { file: File; text: string } | null = null;

/** Reads a text file, refusing binary files by their first bytes (not by extension). */
async function load(source: Source): Promise<string> {
  if (source.kind === "text") {
    if (new TextEncoder().encode(source.text).length > MAX_PASTE_BYTES) throw new Error("The pasted text is larger than 5 MB. Save it as a .txt file and open it instead (up to 50 MB).");
    return source.text;
  }
  if (cached?.file === source.file) return cached.text;
  const head = new Uint8Array(await source.file.slice(0, 4096).arrayBuffer());
  const sig = (b: number[]) => b.every((x, i) => head[i] === x);
  if (sig([0x50, 0x4b, 0x03, 0x04])) throw new Error("This is a Word, Excel or ZIP file. Save it as plain text (.txt) or CSV first.");
  if (sig([0x25, 0x50, 0x44, 0x46])) throw new Error("This is a PDF. Copy its text and paste it here, or save it as .txt.");
  if (!sig([0xff, 0xfe]) && !sig([0xfe, 0xff]) && head.includes(0)) throw new Error("This file contains binary data, so it is not a text file.");
  const bytes = new Uint8Array(await source.file.arrayBuffer());
  const enc = bytes[0] === 0xff && bytes[1] === 0xfe ? "utf-16le" : bytes[0] === 0xfe && bytes[1] === 0xff ? "utf-16be" : "utf-8";
  const text = new TextDecoder(enc).decode(bytes);
  cached = { file: source.file, text };
  return text;
}

ctx.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const m = event.data;
  const t0 = performance.now();
  try {
    const text = await load(m.source);
    if (m.type === "extract") {
      const result = extractAll(text, m.options, (label, fraction) => post({ type: "progress", jobId: m.jobId, label, fraction }));
      post({ type: "extracted", jobId: m.jobId, result, chars: text.length, ms: Math.round(performance.now() - t0) });
    } else {
      // This worker is separate from the built-in extraction, so a runaway pattern only loses its own result.
      const result = customMatches(text, m.pattern, m.flags, m.dedupe, m.flags.includes("i"));
      post({ type: "custom", jobId: m.jobId, result, ms: Math.round(performance.now() - t0) });
    }
  } catch (e) {
    post({ type: "error", jobId: m.jobId, message: e instanceof RangeError ? "The text is too large for this browser's memory." : (e as Error).message });
  }
};
