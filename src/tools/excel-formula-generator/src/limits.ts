// Shared by the browser component and the server. No imports on purpose: a client component
// must not pull in @/lib/tools/llm (B2), so the numbers shown on the page live here.

export const SLUG = "excel-formula-generator";
/** Same numbers as AI_LIMIT in @/lib/tools/llm; a test keeps them in sync. */
export const AI_REQUESTS = 10;
export const AI_WINDOW_MINUTES = 10;
export const MAX_REQUEST_CHARS = 2000;
export const MAX_COLUMNS_CHARS = 2000;
export const LIMIT_TEXT = `${AI_REQUESTS} AI requests per ${AI_WINDOW_MINUTES} minutes`;
