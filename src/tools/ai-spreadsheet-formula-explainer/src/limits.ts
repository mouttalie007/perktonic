// Shared by the browser component and the server. No imports on purpose (B2).

export const SLUG = "ai-spreadsheet-formula-explainer";
/** Same numbers as AI_LIMIT in @/lib/tools/llm; a test keeps them in sync. */
export const AI_REQUESTS = 10;
export const AI_WINDOW_MINUTES = 10;
export const MAX_FORMULA_CHARS = 8000;
export const MAX_SAMPLE_CHARS = 2000;
export const MAX_SUMMARY_WORDS = 80;
export const LIMIT_TEXT = `${AI_REQUESTS} AI requests per ${AI_WINDOW_MINUTES} minutes`;
