import type { Recognise } from "./types";

/** Where the Integrator hosts the tesseract.js core (WASM) and the "fast" language files. */
export const OCR_BASE = "/ocr";

export const LANGUAGES = [
  { id: "eng", label: "English" },
  { id: "ara", label: "Arabic", rtl: true },
  { id: "fra", label: "French" },
  { id: "deu", label: "German" },
  { id: "spa", label: "Spanish" },
] as const;
export type LangId = (typeof LANGUAGES)[number]["id"];

export class OcrUnavailableError extends Error {
  constructor() {
    super("The OCR engine is not installed on this site yet. Please try again later.");
  }
}

/** The real engine (tesseract.js, hosted by us under /ocr); a dynamic import keeps it out of the page until an OCR job starts. */
export async function loadRecogniser(): Promise<Recognise> {
  const { createRecogniser } = await import("../../../_shared/ocrEngine");
  return createRecogniser(OCR_BASE);
}
