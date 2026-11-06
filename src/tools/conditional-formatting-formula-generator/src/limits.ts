// Shared by the browser component and the server. No imports on purpose (B2).

export const SLUG = "conditional-formatting-formula-generator";
/** Same numbers as AI_LIMIT in @/lib/tools/llm; a test keeps them in sync. */
export const AI_REQUESTS = 10;
export const AI_WINDOW_MINUTES = 10;
export const MAX_DESCRIPTION_CHARS = 2000;
export const LIMIT_TEXT = `${AI_REQUESTS} AI requests per ${AI_WINDOW_MINUTES} minutes`;
export const APPS = [
  { id: "excel", label: "Excel" },
  { id: "sheets", label: "Google Sheets" },
] as const;
export type App = (typeof APPS)[number]["id"];
