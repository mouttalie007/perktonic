// Shared by the browser component and the server. No imports on purpose (B2).

export const SLUG = "meeting-minutes-generator-from-transcript";
/** Same numbers as AI_LIMIT in @/lib/tools/llm; a test keeps them in sync. */
export const AI_REQUESTS = 10;
export const AI_WINDOW_MINUTES = 10;
export const LIMIT_TEXT = `${AI_REQUESTS} AI requests per ${AI_WINDOW_MINUTES} minutes`;

/** A 60 to 90 minute meeting. callLlm's MAX_USER_CHARS is raised to the same value in production. */
export const MAX_TRANSCRIPT_CHARS = 60000;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_TITLE_CHARS = 200;
/** A due date further than this from the reference date is not a deadline. */
export const MAX_YEARS_FROM_REFERENCE = 5;

export const LANGUAGES = [
  { id: "auto", label: "Same as the transcript" },
  { id: "en", label: "English" },
  { id: "fr", label: "French" },
  { id: "de", label: "German" },
  { id: "es", label: "Spanish" },
  { id: "it", label: "Italian" },
  { id: "pt", label: "Portuguese" },
  { id: "nl", label: "Dutch" },
  { id: "ar", label: "Arabic" },
] as const;
export type LanguageId = (typeof LANGUAGES)[number]["id"];

export const RECORDING_NOTE = "Transcripts of meetings contain personal data. Everyone who was recorded should know about the recording and about this use of it.";
