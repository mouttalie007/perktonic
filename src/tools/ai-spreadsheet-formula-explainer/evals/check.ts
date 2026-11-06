// Pure checks the Integrator runs on the real model's answers (a test runs them on golden.json).
// mustContain / mustNotContain entries are regular expressions (case-insensitive) so that
// alternative wordings pass; they apply to the explanation (summary and step texts, plus parts for mustContain).
import { MAX_SUMMARY_WORDS } from "../src/limits";
import { matchPart } from "../src/logic/unescape";
import { SYSTEM_PROMPT } from "../src/llm/prompt";
import { ModelAnswer } from "../src/llm/schema";

export interface EvalCase {
  id: string;
  input: { formula: string; sampleValues: string };
  expect: { status: "ok" | "needs_clarification" | "refused"; mustContain: string[]; mustNotContain: string[] };
}

const LEAK_PROBES = SYSTEM_PROMPT.split(/[.:]\s+/).filter((s) => s.length > 40).slice(0, 12);

/**
 * Numbers presented as the calculated result of the sample values ("the total is 90", "= 30", "returns 4.5")
 * that appear neither in the formula nor in the sample values. Other numbers (counts of steps, "2 decimal
 * places", row numbers) are fine.
 */
export function calculatedResults(text: string, input: { formula: string; sampleValues: string }): string[] {
  if (!/\d/.test(input.sampleValues)) return [];
  const known = new Set((input.formula + " " + input.sampleValues).match(/\d+(?:\.\d+)?/g) ?? []);
  const re = /\b(?:is|are|equals?|gives?|returns?|results? in|comes? to|totals?|makes?|works out (?:to|at)|=)\s+(?:about |approximately |roughly |exactly )?(-?\d[\d,]*(?:\.\d+)?)/gi;
  const out = new Set<string>();
  for (const m of text.matchAll(re)) {
    const n = m[1].replace(/,/g, "");
    if (!known.has(n) && !known.has(n.replace(/^-/, ""))) out.add(m[1]);
  }
  return [...out];
}

export function checkCase(testCase: EvalCase, output: unknown): string[] {
  const problems: string[] = [];
  const parsed = ModelAnswer.safeParse(output);
  if (!parsed.success) return [`output does not match the schema: ${parsed.error.issues[0]?.message ?? "invalid"}`];
  const a = parsed.data;
  if (a.status !== testCase.expect.status) problems.push(`status is "${a.status}", expected "${testCase.expect.status}"`);
  const prose = a.status === "ok" ? [a.summary, ...a.steps.map((s) => s.text)].join("\n") : a.message;
  const searchable = a.status === "ok" ? [prose, ...a.steps.map((s) => s.part)].join("\n") : prose;
  for (const s of testCase.expect.mustContain) if (!new RegExp(s, "i").test(searchable)) problems.push(`missing /${s}/`);
  for (const s of testCase.expect.mustNotContain) if (new RegExp(s, "i").test(prose)) problems.push(`must not contain /${s}/`);
  for (const probe of LEAK_PROBES) if (prose.includes(probe)) problems.push("quotes the system prompt");
  if (a.status === "ok") {
    const missing = a.steps.filter((s) => matchPart(s.part, testCase.input.formula) === null);
    if (missing.length) problems.push(`${missing.length} step(s) quote text that is not in the formula: ${missing.map((s) => JSON.stringify(s.part)).join(", ")}`);
    const words = a.summary.split(/\s+/).filter(Boolean).length;
    if (words > MAX_SUMMARY_WORDS) problems.push(`summary has ${words} words`);
    const invented = calculatedResults(prose, testCase.input);
    if (invented.length) problems.push(`states calculated results of the sample values: ${invented.join(", ")}`);
  }
  return problems;
}
