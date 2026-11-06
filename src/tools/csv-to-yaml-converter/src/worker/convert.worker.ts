/// <reference lib="webworker" />
import { convert, ConvertError, type Converted } from "../logic/convert";
import { decodeBytes, detectEncoding, ENCODING_LABELS } from "../logic/encoding";
import { checkFile } from "../logic/input";
import { MAX_PASTE_BYTES, type ConvertOptions } from "../logic/options";

export type Source = { kind: "text"; text: string } | { kind: "file"; file: File };
export type WorkerRequest = { jobId: number; source: Source; options: ConvertOptions };
export type WorkerResponse =
  | { type: "progress"; jobId: number; label: string }
  | ({ type: "result"; jobId: number; encoding: string | null; ms: number } & Converted)
  | { type: "error"; jobId: number; message: string; line: number | null };

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const post = (m: WorkerResponse) => ctx.postMessage(m);
let cache: { file: File; text: string; encoding: string } | null = null;

async function run({ jobId, source, options }: WorkerRequest) {
  const t0 = performance.now();
  let text: string;
  let encoding: string | null = null;
  if (source.kind === "file") {
    if (cache?.file === source.file) {
      text = cache.text;
      encoding = cache.encoding;
    } else {
      const problem = checkFile(new Uint8Array(await source.file.slice(0, 4096).arrayBuffer()), source.file.size);
      if (problem) return post({ type: "error", jobId, message: problem, line: null });
      post({ type: "progress", jobId, label: "Reading the file" });
      const bytes = new Uint8Array(await source.file.arrayBuffer());
      // YAML, XML and TOML are UTF-8 by definition; CSV exported from Excel often is not.
      const guess = options.from === "csv" ? detectEncoding(bytes) : { encoding: "utf-8" as const, reason: "" };
      text = decodeBytes(bytes, guess.encoding);
      encoding = ENCODING_LABELS[guess.encoding];
      cache = { file: source.file, text, encoding };
    }
  } else {
    text = source.text;
    if (new TextEncoder().encode(text).length > MAX_PASTE_BYTES) return post({ type: "error", jobId, message: "The pasted text is larger than 5 MB. Save it as a file and open it instead (up to 50 MB).", line: null });
  }
  post({ type: "progress", jobId, label: "Converting" });
  try {
    const r = convert(text, options);
    post({ type: "result", jobId, encoding, ms: Math.round(performance.now() - t0), ...r });
  } catch (e) {
    if (e instanceof ConvertError) return post({ type: "error", jobId, message: e.message, line: e.line });
    throw e;
  }
}

ctx.onmessage = (event: MessageEvent<WorkerRequest>) => {
  run(event.data).catch((e: unknown) => {
    post({ type: "error", jobId: event.data.jobId, message: e instanceof RangeError ? "The file is too large for this browser's memory. Try a smaller file." : "Something went wrong while converting. Check that the input matches the format chosen in “From”.", line: null });
  });
};
