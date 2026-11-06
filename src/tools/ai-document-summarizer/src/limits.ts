// Shared by the browser component and the server. No imports on purpose (B2).

export const SLUG = "ai-document-summarizer";
/** Same numbers as AI_LIMIT in @/lib/tools/llm; a test keeps them in sync. */
export const AI_REQUESTS = 10;
export const AI_WINDOW_MINUTES = 10;
export const MAX_TEXT_CHARS = 20000;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const LIMIT_TEXT = `${AI_REQUESTS} AI requests per ${AI_WINDOW_MINUTES} minutes`;

export const LENGTHS = [
  { id: "short", label: "Short (about 3 sentences)" },
  { id: "medium", label: "Medium (1 paragraph)" },
  { id: "long", label: "Long (2 paragraphs)" },
] as const;
export const TONES = [
  { id: "executive", label: "Executive" },
  { id: "technical", label: "Technical" },
  { id: "simple", label: "Simple" },
] as const;
export type LengthId = (typeof LENGTHS)[number]["id"];
export type ToneId = (typeof TONES)[number]["id"];
