// Pure checks the Integrator runs on the real model's answers (a test runs them on golden.json).
// mustContain: regexes over labels, values and notes; mustNotContain: regexes over the extracted terms
// (the artifact) or the message. categories: must be found; notFound: must stay empty (never filled in).
import type { CategoryId } from "../src/limits";
import { verifyClauseRef } from "../src/logic/clauses";
import { verifyNormalised, type Normalised } from "../src/logic/normalise";
import { containsCollapsed } from "../src/logic/text";
import { SYSTEM_PROMPT } from "../src/llm/prompt";
import { ModelAnswer } from "../src/llm/schema";

export interface EvalCase {
  id: string;
  input: { text: string; focus: string };
  expect: { status: "ok" | "needs_clarification" | "refused"; mustContain: string[]; mustNotContain: string[]; categories?: CategoryId[]; notFound?: CategoryId[]; legalNote?: boolean };
}

const LEAK_PROBES = SYSTEM_PROMPT.split(/[.:]\s+/).filter((s) => s.length > 40);

export function checkCase(testCase: EvalCase, output: unknown): string[] {
  const problems: string[] = [];
  const parsed = ModelAnswer.safeParse(output);
  if (!parsed.success) return [`output does not match the schema: ${parsed.error.issues[0]?.message ?? "invalid"}`];
  const a = parsed.data;
  if (a.status !== testCase.expect.status) problems.push(`status is "${a.status}", expected "${testCase.expect.status}"`);
  const searchable = a.status === "ok" ? [...a.terms.map((t) => `${t.label}\n${t.value}`), ...a.notes].join("\n") : a.message;
  const artifact = a.status === "ok" ? JSON.stringify(a.terms) + "\n" + a.notes.join("\n") : a.message;
  for (const s of testCase.expect.mustContain) if (!new RegExp(s, "i").test(searchable)) problems.push(`missing /${s}/`);
  for (const s of testCase.expect.mustNotContain) if (new RegExp(s, "i").test(artifact)) problems.push(`must not contain /${s}/`);
  for (const probe of LEAK_PROBES) if (JSON.stringify(a).includes(probe)) problems.push("quotes the system prompt");
  if (a.status === "ok") {
    const { text } = testCase.input;
    a.terms.forEach((t, n) => {
      const at = `term ${n + 1} (${t.category})`;
      if (!containsCollapsed(text, t.quote)) problems.push(`${at}: quote is not in the contract`);
      if (t.normalised !== null && verifyNormalised(t.normalised as Normalised, t.quote) === null) problems.push(`${at}: normalised value is not literally in the quote`);
      if (t.clauseRef && verifyClauseRef(t.clauseRef, t.quote, text) === null) problems.push(`${at}: clause reference "${t.clauseRef}" is not in the quote or the line above`);
    });
    const found = new Set(a.terms.map((t) => t.category));
    for (const c of testCase.expect.categories ?? []) if (!found.has(c)) problems.push(`category ${c} not found`);
    for (const c of testCase.expect.notFound ?? []) if (found.has(c)) problems.push(`category ${c} must stay "not found" (it is not in the text)`);
    if (testCase.expect.legalNote && /\b(is|appears|seems) (likely )?(enforceable|valid|binding)\b/i.test(a.notes.join(" "))) problems.push("the notes give a view on enforceability");
  }
  return problems;
}
