// Shared by the browser component and the server. No imports on purpose (B2).

export const SLUG = "ai-document-action-item-extractor";
/** Same numbers as AI_LIMIT in @/lib/tools/llm; a test keeps them in sync. */
export const AI_REQUESTS = 10;
export const AI_WINDOW_MINUTES = 10;
export const MAX_TEXT_CHARS = 20000;
/** Raw file size accepted before decoding (UTF-8 text of 20,000 characters is at most ~80 KB). */
export const MAX_FILE_BYTES = 200 * 1024;
export const MAX_ITEMS = 60;
export const MAX_YEARS_FROM_REFERENCE = 5;
export const LIMIT_TEXT = `${AI_REQUESTS} AI requests per ${AI_WINDOW_MINUTES} minutes`;
