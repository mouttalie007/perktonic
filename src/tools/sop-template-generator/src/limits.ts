// Shared by the browser component and the server. No imports on purpose (B2).

export const SLUG = "sop-template-generator";
/** Same numbers as AI_LIMIT in @/lib/tools/llm; a test keeps them in sync. */
export const AI_REQUESTS = 10;
export const AI_WINDOW_MINUTES = 10;
export const LIMIT_TEXT = `${AI_REQUESTS} AI requests per ${AI_WINDOW_MINUTES} minutes`;

export const MAX_NAME_CHARS = 120;
export const MAX_INDUSTRY_CHARS = 80;
export const MAX_TEAM_CHARS = 40;
export const MAX_OWNER_CHARS = 80;
/** "never more than 2 000 characters of steps" are sent to the AI. */
export const MAX_STEPS_CHARS = 2000;
export const MAX_STEPS = 30;

export const PLACEHOLDER = "[to be completed]";

export const DOC_TYPES = [
  { id: "sop", label: "Standard operating procedure (SOP)", short: "SOP", noun: "procedure" },
  { id: "policy", label: "Policy", short: "Policy", noun: "policy" },
  { id: "onboarding", label: "Onboarding checklist", short: "Onboarding checklist", noun: "checklist" },
  { id: "process", label: "Process documentation", short: "Process documentation", noun: "document" },
] as const;
export type DocTypeId = (typeof DOC_TYPES)[number]["id"];

/** The fixed structure, in this order, in every document and every export. */
export const SECTIONS = ["Purpose", "Scope", "Roles and responsibilities", "Steps", "KPIs", "Revision history"] as const;
