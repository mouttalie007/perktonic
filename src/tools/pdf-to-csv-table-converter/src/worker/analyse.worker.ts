/// <reference lib="webworker" />
// Reads the PDF and finds its tables off the main thread. pdf.js runs here in-process
// (its worker module is imported below, so no second worker and no CDN are needed).
import { MAX_PAGES } from "../limits";
import { analyseDoc, parsePageRange } from "../logic/pdfTables";
import { TAG, type AnalyseBody, type AnalyseRequest } from "./protocol";

const post = (m: AnalyseBody) => (self as unknown as DedicatedWorkerGlobalScope).postMessage({ ...m, tag: TAG });

self.onmessage = async (e: MessageEvent<AnalyseRequest>) => {
  const req = e.data;
  // Messages for pdf.js's own handler (it listens on the same worker) are not requests.
  if (!req || !(req.bytes instanceof ArrayBuffer)) return;
  try {
    const pdfjs = await import("pdfjs-dist");
    (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = await import("pdfjs-dist/build/pdf.worker.mjs");
    let doc;
    const task = pdfjs.getDocument({ data: new Uint8Array(req.bytes), password: req.password || undefined, verbosity: 0, useSystemFonts: false, disableFontFace: true, isOffscreenCanvasSupported: false });
    try {
      doc = await task.promise;
    } catch (err) {
      const e2 = err as { name?: string; code?: number };
      if (e2.name === "PasswordException") {
        post(e2.code === 2 ? { type: "error", code: "password_wrong", message: "That password is not correct. Try again." } : { type: "error", code: "password_required", message: "This PDF is protected by a password. Type the password to open it; it stays in your browser." });
        return;
      }
      post({ type: "error", code: "invalid", message: "This PDF could not be read. It may be damaged; try saving it again from the program that made it." });
      return;
    }
    if (doc.numPages > MAX_PAGES && !req.range.trim()) {
      post({ type: "error", code: "too_many_pages", message: `This PDF has ${doc.numPages} pages. The limit is ${MAX_PAGES}: type a page range such as "1-${MAX_PAGES}".` });
      return;
    }
    const range = parsePageRange(req.range, doc.numPages);
    if (!range.ok) {
      post({ type: "error", code: "range", message: range.error });
      return;
    }
    if (range.pages.length > MAX_PAGES) {
      post({ type: "error", code: "too_many_pages", message: `That range has ${range.pages.length} pages. The limit is ${MAX_PAGES} pages at a time.` });
      return;
    }
    post({ type: "opened", numPages: doc.numPages, pages: range.pages.length });
    const analysis = await analyseDoc(doc, { pages: range.pages, method: req.method, ops: pdfjs.OPS, onPage: (done, total) => post({ type: "progress", done, total }) });
    post({ type: "done", analysis, numPages: doc.numPages });
    await task.destroy();
  } catch {
    post({ type: "error", code: "invalid", message: "Something went wrong while reading this PDF. Try another file or a smaller page range." });
  }
};
