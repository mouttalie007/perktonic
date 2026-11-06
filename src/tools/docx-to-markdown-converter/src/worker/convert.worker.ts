/// <reference lib="webworker" />
import { ConvertError, docxToMarkdown } from "../logic/fromDocx";
import { markdownToDocx } from "../logic/toDocx";
import { MAX_FILE_BYTES, MAX_PASTE_BYTES, type DocStats, type ImageMode, type Warning } from "../logic/types";
import { SAMPLE_DOCX_BASE64, SAMPLE_DOCX_NAME } from "../../fixtures/sampleDocx";

export type WorkerRequest =
  | { type: "toMarkdown"; jobId: number; source: { kind: "sample" } | { kind: "file"; file: File }; imageMode: ImageMode }
  | { type: "toDocx"; jobId: number; source: { kind: "text"; text: string } | { kind: "file"; file: File } };

export type WorkerResponse =
  | { type: "progress"; jobId: number; label: string; fraction: number }
  | { type: "markdown"; jobId: number; name: string; markdown: string; warnings: Warning[]; stats: DocStats; zip: Blob | null; imageCount: number; ms: number; bytes: number }
  | { type: "docx"; jobId: number; name: string; docx: Blob; warnings: Warning[]; stats: DocStats; readBack: string; ms: number }
  | { type: "error"; jobId: number; message: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const post = (m: WorkerResponse) => ctx.postMessage(m);
const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function sampleBytes(): Uint8Array {
  const bin = atob(SAMPLE_DOCX_BASE64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function toMarkdown(jobId: number, req: Extract<WorkerRequest, { type: "toMarkdown" }>) {
  const t0 = performance.now();
  let bytes: Uint8Array;
  let name: string;
  if (req.source.kind === "sample") {
    bytes = sampleBytes();
    name = SAMPLE_DOCX_NAME;
  } else {
    const f = req.source.file;
    if (f.size === 0) throw new ConvertError(`${f.name} is empty.`);
    if (f.size > MAX_FILE_BYTES) throw new ConvertError(`${f.name} is ${(f.size / 1048576).toFixed(1)} MB. The limit is 50 MB.`);
    post({ type: "progress", jobId, label: "Reading the file", fraction: 0.02 });
    bytes = new Uint8Array(await f.arrayBuffer());
    name = f.name;
  }
  const r = await docxToMarkdown(bytes, req.imageMode, (label, fraction) => post({ type: "progress", jobId, label, fraction }));
  post({
    type: "markdown",
    jobId,
    name: name.replace(/\.docx$/i, ""),
    markdown: r.markdown,
    warnings: r.warnings,
    stats: r.stats,
    zip: r.zip ? new Blob([r.zip as BlobPart], { type: "application/zip" }) : null,
    imageCount: r.imageCount,
    ms: Math.round(performance.now() - t0),
    bytes: bytes.length,
  });
}

async function toDocx(jobId: number, req: Extract<WorkerRequest, { type: "toDocx" }>) {
  const t0 = performance.now();
  let text: string;
  let name = "document";
  if (req.source.kind === "text") {
    text = req.source.text;
    if (new TextEncoder().encode(text).length > MAX_PASTE_BYTES) throw new ConvertError("The pasted Markdown is larger than 5 MB. Save it as a .md file and open it instead (up to 50 MB).");
  } else {
    const f = req.source.file;
    if (f.size > MAX_FILE_BYTES) throw new ConvertError(`${f.name} is ${(f.size / 1048576).toFixed(1)} MB. The limit is 50 MB.`);
    const bytes = new Uint8Array(await f.arrayBuffer());
    const starts = (sig: number[]) => sig.every((b, i) => bytes[i] === b);
    if (starts([0x50, 0x4b, 0x03, 0x04])) throw new ConvertError(`${f.name} is a Word or ZIP file. To convert Word to Markdown, switch to “Word → Markdown”.`);
    if (starts([0x25, 0x50, 0x44, 0x46])) throw new ConvertError(`${f.name} is a PDF, not a Markdown file.`);
    if (bytes.subarray(0, 8192).includes(0)) throw new ConvertError(`${f.name} contains binary data, so it is not a Markdown text file.`);
    text = new TextDecoder().decode(bytes);
    name = f.name.replace(/\.(md|markdown|txt)$/i, "");
  }
  if (text.trim() === "") throw new ConvertError("The Markdown is empty.");
  post({ type: "progress", jobId, label: "Building the Word file", fraction: 0.3 });
  const title = /^#\s+(.+)$/m.exec(text)?.[1]?.slice(0, 120) ?? name;
  if (req.source.kind === "text") name = title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "document";
  const r = await markdownToDocx(text, title);
  post({ type: "progress", jobId, label: "Reading it back to check", fraction: 0.8 });
  const back = await docxToMarkdown(r.docx, "zip");
  post({ type: "docx", jobId, name, docx: new Blob([r.docx as BlobPart], { type: DOCX_TYPE }), warnings: r.warnings, stats: r.stats, readBack: back.markdown, ms: Math.round(performance.now() - t0) });
}

ctx.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  try {
    if (req.type === "toMarkdown") await toMarkdown(req.jobId, req);
    else await toDocx(req.jobId, req);
  } catch (err) {
    const message =
      err instanceof ConvertError
        ? err.message
        : err instanceof RangeError
          ? "The browser ran out of memory for this document. Try a smaller file."
          : req.type === "toMarkdown"
            ? "This document could not be converted. It may be damaged or use a feature the converter cannot read; try saving it again in Word."
            : "The Markdown could not be converted to Word.";
    post({ type: "error", jobId: req.jobId, message });
  }
};
