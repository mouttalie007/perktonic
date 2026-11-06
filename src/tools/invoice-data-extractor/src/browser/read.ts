// Reading an invoice in the browser: the PDF text layer with pdf.js, or OCR of an image or a scanned
// PDF through the shared OCR interface. Only the resulting text (and OCR word confidences) is sent.
import { MAX_PDF_PAGES, MAX_WIDTH, PDF_SCALE } from "../limits";
import { checkFile } from "../logic/file";
import { linesFromPdfItems, textFromWords } from "../logic/readText";
import { loadRecogniser } from "../ocr/engine";
import type { OcrWord, Recognise } from "../ocr/types";
import type { PrepareRequest, PrepareResult } from "../worker/prepare.worker";

export interface ReadResult {
  text: string;
  source: "pdf" | "ocr";
  words?: { text: string; confidence: number }[];
}

export class ReadError extends Error {}

function imageData(source: CanvasImageSource, w: number, h: number): ImageData {
  const scale = Math.min(1, MAX_WIDTH / w);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function prepare(img: ImageData): Promise<PrepareResult> {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL("../worker/prepare.worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (e: MessageEvent<PrepareResult>) => {
      resolve(e.data);
      w.terminate();
    };
    w.onerror = () => {
      reject(new ReadError("The image could not be prepared for OCR."));
      w.terminate();
    };
    const req: PrepareRequest = { width: img.width, height: img.height, buffer: img.data.buffer.slice(0) as ArrayBuffer, options: { contrast: true, deskew: true, threshold: false } };
    w.postMessage(req, [req.buffer]);
  });
}

async function ocr(images: ImageData[], lang: string, recognise: Recognise | undefined, onProgress: (f: number) => void): Promise<ReadResult> {
  const engine = recognise ?? (await loadRecogniser());
  const words: OcrWord[] = [];
  const texts: string[] = [];
  for (const [i, img] of images.entries()) {
    const p = await prepare(img);
    const page = await engine({ width: p.width, height: p.height, data: new Uint8ClampedArray(p.buffer) }, lang, (f) => onProgress((i + f) / images.length));
    words.push(...page);
    texts.push(textFromWords(page));
  }
  return { text: texts.join("\n\n"), source: "ocr", words: words.map((w) => ({ text: w.text, confidence: w.confidence })) };
}

export async function readInvoice(file: File, opts: { lang: string; recognise?: Recognise; onProgress: (f: number, stage: string) => void }): Promise<ReadResult> {
  const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
  const check = checkFile(file.size, head);
  if (!check.ok) throw new ReadError(check.error);
  if (check.kind !== "pdf") {
    opts.onProgress(0, "Reading the image");
    const bitmap = await createImageBitmap(file);
    const img = imageData(bitmap, bitmap.width, bitmap.height);
    bitmap.close();
    return ocr([img], opts.lang, opts.recognise, (f) => opts.onProgress(f, "Reading the text (OCR)"));
  }
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerPort ??= new Worker(new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url), { type: "module" });
  let doc;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), verbosity: 0 }).promise;
  } catch (e) {
    throw new ReadError((e as { name?: string }).name === "PasswordException" ? "This PDF is protected by a password. Remove the password and try again." : "This PDF could not be read.");
  }
  if (doc.numPages > MAX_PDF_PAGES) throw new ReadError(`This PDF has ${doc.numPages} pages. An invoice of up to ${MAX_PDF_PAGES} pages can be read: split it first.`);
  const pages: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    opts.onProgress((n - 1) / doc.numPages, "Reading the PDF text");
    const page = await doc.getPage(n);
    pages.push(linesFromPdfItems((await page.getTextContent()).items));
  }
  const text = pages.join("\n\n").trim();
  if (text.replace(/\s/g, "").length >= 20) return { text, source: "pdf" };
  // No text layer: a scanned PDF. Render each page and read it with OCR.
  const images: ImageData[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    opts.onProgress((n - 1) / doc.numPages, "Rendering the scanned page");
    const page = await doc.getPage(n);
    const vp = page.getViewport({ scale: PDF_SCALE });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(vp.width);
    canvas.height = Math.round(vp.height);
    await page.render({ canvas, viewport: vp }).promise;
    images.push(imageData(canvas, canvas.width, canvas.height));
  }
  return ocr(images, opts.lang, opts.recognise, (f) => opts.onProgress(f, "Reading the text (OCR)"));
}
