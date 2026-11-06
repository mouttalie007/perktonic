// Shared by the browser component and the server. No imports on purpose (B2).

export const SLUG = "contract-key-terms-extractor";
/** Same numbers as AI_LIMIT in @/lib/tools/llm; a test keeps them in sync. */
export const AI_REQUESTS = 10;
export const AI_WINDOW_MINUTES = 10;
export const MAX_TEXT_CHARS = 20000;
export const MAX_FOCUS_CHARS = 300;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const LIMIT_TEXT = `${AI_REQUESTS} AI requests per ${AI_WINDOW_MINUTES} minutes`;

/** Mandatory, always visible, cannot be dismissed; also the first line of every export. */
export const DISCLAIMER = "This is not legal advice. The tool can miss or misread clauses; a qualified professional must review the contract.";
export const LEGAL_QUESTION_NOTE = "This tool cannot judge whether a contract (or a clause) is valid, enforceable or fair, and it does not give legal advice. The terms below are only what the text says; ask a qualified professional about the rest.";

export const CATEGORIES = [
  { id: "parties", label: "Parties" },
  { id: "effective_date", label: "Effective date" },
  { id: "term_or_expiry", label: "Term or expiry" },
  { id: "payment", label: "Payment" },
  { id: "renewal", label: "Renewal" },
  { id: "termination", label: "Termination" },
  { id: "obligation", label: "Obligations" },
  { id: "governing_law", label: "Governing law" },
  { id: "confidentiality", label: "Confidentiality" },
  { id: "liability", label: "Liability" },
  { id: "other", label: "Other" },
] as const;
export type CategoryId = (typeof CATEGORIES)[number]["id"];
