// Shared by the browser component and the server. No imports on purpose (B2).

export const SLUG = "invoice-data-extractor";
/** Same numbers as AI_LIMIT in @/lib/tools/llm; a test keeps them in sync. */
export const AI_REQUESTS = 10;
export const AI_WINDOW_MINUTES = 10;
export const LIMIT_TEXT = `${AI_REQUESTS} AI requests per ${AI_WINDOW_MINUTES} minutes`;

export const MAX_FILES = 5;
export const MAX_BYTES = 10 * 1024 * 1024;
export const MAX_PDF_PAGES = 5;
export const MAX_TEXT_CHARS = 20000;
/** OCR words sent with the text (for the confidence of each field), at most. */
export const MAX_WORDS = 5000;
export const PDF_SCALE = 200 / 72;
export const MAX_WIDTH = 2600;
export const LOW_OCR = 70;

export const RETENTION = "We do not store your invoices, their text or the results. Only the extracted text is sent, to our server and to the AI provider, to produce the answer; identical requests may be answered from a short-lived cache.";
