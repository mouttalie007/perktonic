// No imports: shared by the page, the worker and the logic.

export type Flavor = "javascript" | "python" | "pcre" | "java" | "go";

export const FLAVORS: { id: Flavor; label: string }[] = [
  { id: "javascript", label: "JavaScript" },
  { id: "python", label: "Python (re)" },
  { id: "pcre", label: "PCRE / PHP" },
  { id: "java", label: "Java" },
  { id: "go", label: "Go (RE2)" },
];

export const FLAGS: { id: string; label: string; help: string }[] = [
  { id: "g", label: "g", help: "global: find every match, not only the first" },
  { id: "i", label: "i", help: "ignore case" },
  { id: "m", label: "m", help: "multiline: ^ and $ match at line breaks" },
  { id: "s", label: "s", help: "dotAll: . also matches line breaks" },
  { id: "u", label: "u", help: "unicode: code points, \\p{…} and strict escapes" },
  { id: "y", label: "y", help: "sticky: match only at lastIndex" },
];

export const MAX_PATTERN_CHARS = 20_000;
/** Characters of the test text shown with highlighting; matching still covers the whole text. */
export const MAX_HIGHLIGHT_CHARS = 20_000;
export const MAX_TEXT_BYTES = 5 * 1024 * 1024;
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_MATCHES = 10_000;
export const TIMEOUT_MS = 1000;

export interface MatchInfo {
  index: number;
  end: number;
  text: string;
  /** Numbered groups (1…n): value and span, or null when the group did not take part. */
  groups: ({ text: string; start: number; end: number } | null)[];
  named: Record<string, string | null>;
}
