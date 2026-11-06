import { MAX_STEPS } from "../limits";

/** One step per line; bullets and numbering ("1.", "2)", "-", "•", "Step 3:") are removed. */
export function splitSteps(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:(?:step\s*)?\d{1,3}\s*[.):-]|[-*•–]|\[\s?[xX]?\s?\])\s*/i, "").trim())
    .filter((l) => l.length > 0)
    .slice(0, MAX_STEPS);
}

export const collapse = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
