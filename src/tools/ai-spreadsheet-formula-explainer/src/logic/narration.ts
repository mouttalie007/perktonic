import type { Narration } from "../types";
import { functionCalls, parseFormula } from "./parse";
import { matchPart } from "./unescape";

export type Answer = { status: "ok"; summary: string; steps: { part: string; text: string }[] } | { status: "needs_clarification" | "refused"; message: string };

/** Keep only the steps that quote the formula exactly (after un-escaping HTML entities); count the rest. */
export function buildNarration(answer: Answer, formula: string, cached: boolean): Narration {
  if (answer.status !== "ok") return { status: answer.status, formula, message: answer.message, cached };
  const kept: { part: string; text: string }[] = [];
  for (const s of answer.steps) {
    const part = matchPart(s.part, formula);
    if (part !== null) kept.push({ part, text: s.text });
  }
  return { status: "ok", formula, summary: answer.summary, steps: kept, dropped: answer.steps.length - kept.length, cached };
}

/** Function names from the outside in, given to the model as a hint (our parser, not the model). */
export function outlineForModel(formula: string): string {
  const { ast } = parseFormula(formula);
  const names = functionCalls(ast).map((c) => c.name);
  return names.length ? names.join(" > ") : "(no functions)";
}
