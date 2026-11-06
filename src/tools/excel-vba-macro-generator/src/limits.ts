// Shared by the browser component and the server. No imports on purpose (B2).

export const SLUG = "excel-vba-macro-generator";
/** Same numbers as AI_LIMIT in @/lib/tools/llm; a test keeps them in sync. */
export const AI_REQUESTS = 10;
export const AI_WINDOW_MINUTES = 10;
export const MAX_DESCRIPTION_CHARS = 2000;
export const MAX_CODE_CHARS = 20000;
export const LIMIT_TEXT = `${AI_REQUESTS} AI requests per ${AI_WINDOW_MINUTES} minutes`;
export const DISCLAIMER = "Macros can change or delete files and send data. Read the code and try it on a copy of your workbook first.";
