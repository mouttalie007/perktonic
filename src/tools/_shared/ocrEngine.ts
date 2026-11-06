/**
 * The real OCR engine for tools 3.4 and 3.5: tesseract.js in a Web Worker, with the worker script,
 * the WASM core and the "fast" language files hosted by us under /ocr (public/ocr, see README.txt there).
 * No third-party request at runtime. Loaded with a dynamic import so it never weighs on a page
 * until a visitor actually starts an OCR job.
 *
 * Same shape as the OCR interface the tools define in their own src/ocr/types.ts (kept structural here
 * so this shared file imports nothing from a tool).
 */
import type { Worker as TesseractWorker } from "tesseract.js";

export interface ImageLike {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}
export interface OcrWord {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}
export type Recognise = (image: ImageLike, lang: string, onProgress: (fraction: number) => void) => Promise<OcrWord[]>;

const ALLOWED = new Set(["eng", "ara", "fra", "deu", "spa"]);
/** A "word" made only of these characters is a table rule or a smudge, never content. */
const RULE_NOISE = /^[|_=~.,:;'"`\\/–—-]+$/;

async function toBlob(image: ImageLike): Promise<Blob> {
  const data = new ImageData(new Uint8ClampedArray(image.data), image.width, image.height);
  if (typeof OffscreenCanvas !== "undefined") {
    const c = new OffscreenCanvas(image.width, image.height);
    c.getContext("2d")!.putImageData(data, 0, 0);
    return c.convertToBlob({ type: "image/png" });
  }
  const c = document.createElement("canvas");
  c.width = image.width;
  c.height = image.height;
  c.getContext("2d")!.putImageData(data, 0, 0);
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode the image."))), "image/png"));
}

/** `base` is where the OCR files live (the tools pass "/ocr"). One worker is kept per language and reused. */
export function createRecogniser(base: string): Recognise {
  const workers = new Map<string, Promise<TesseractWorker>>();
  let onProgress: (f: number) => void = () => {};
  const abs = (p: string) => new URL(p, self.location.href).href;

  const workerFor = (lang: string) => {
    let w = workers.get(lang);
    if (!w) {
      w = import("tesseract.js").then(({ createWorker }) =>
        createWorker(lang, 1, {
          workerPath: abs(`${base}/worker.min.js`),
          corePath: abs(base),
          langPath: abs(base),
          gzip: false,
          cacheMethod: "write",
          logger: (m) => {
            if (m.status === "recognizing text") onProgress(m.progress);
          },
        }),
      );
      workers.set(lang, w);
      // A failed start must not be cached, or the visitor could never retry.
      w.catch(() => workers.delete(lang));
    }
    return w;
  };

  return async (image, lang, progress) => {
    if (!ALLOWED.has(lang)) throw new Error(`Unsupported OCR language: ${lang}`);
    onProgress = progress;
    const worker = await workerFor(lang);
    // Sparse text (11) finds words anywhere on the page: on ruled tables the single-block mode (6) reads the grid lines as noise and returns garbage.
    await worker.setParameters({ tessedit_pageseg_mode: "11" as never, preserve_interword_spaces: "1" });
    const { data } = await worker.recognize(await toBlob(image), {}, { blocks: true });
    const words: OcrWord[] = [];
    for (const block of data.blocks ?? [])
      for (const para of block.paragraphs ?? [])
        for (const line of para.lines ?? [])
          for (const w of line.words ?? []) {
            const text = (w.text ?? "").trim();
            // table rules are read as words made only of `|`, `_`, `-` and similar: they are not content
            if (text && !RULE_NOISE.test(text)) words.push({ text, confidence: w.confidence, bbox: { x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 } });
          }
    progress(1);
    return words;
  };
}
