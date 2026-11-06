// Test helper: reads a PDF with pdf.js in Node (legacy build, worker code run in-process).
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { analyseDoc, type MethodChoice } from "../src/logic/pdfTables";

let ready: Promise<void> | null = null;
function init() {
  ready ??= import("pdfjs-dist/legacy/build/pdf.worker.mjs").then((w) => {
    (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = w;
  });
  return ready;
}

export async function openPdf(bytes: Uint8Array, password?: string) {
  await init();
  return pdfjs.getDocument({ data: bytes.slice(), password, verbosity: 0, useSystemFonts: false }).promise;
}

export async function analyse(bytes: Uint8Array, method: MethodChoice = "auto", pages?: number[]) {
  const doc = await openPdf(bytes);
  const all = Array.from({ length: doc.numPages }, (_, i) => i + 1);
  return analyseDoc(doc, { pages: pages ?? all, method, ops: pdfjs.OPS });
}
