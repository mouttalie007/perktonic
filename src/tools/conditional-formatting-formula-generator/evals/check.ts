// Pure checks the Integrator runs on the real model's answers (a test runs them on golden.json).
import type { App } from "../src/limits";
import { ruleWarnings } from "../src/logic/aiResult";
import { SYSTEM_PROMPT } from "../src/llm/prompt";
import { ModelAnswer } from "../src/llm/schema";

export interface EvalCase {
  id: string;
  input: { description: string; range: string; platform: App };
  expect: { status: "ok" | "needs_clarification" | "refused"; kind?: "conditional_formatting" | "data_validation"; mustContain: string[]; mustNotContain: string[] };
}

const LEAK_PROBES = SYSTEM_PROMPT.split(/[.:]\s+/).filter((s) => s.length > 40);

export function checkCase(testCase: EvalCase, output: unknown): string[] {
  const problems: string[] = [];
  const parsed = ModelAnswer.safeParse(output);
  if (!parsed.success) return [`output does not match the schema: ${parsed.error.issues[0]?.message ?? "invalid"}`];
  const a = parsed.data;
  if (a.status !== testCase.expect.status) problems.push(`status is "${a.status}", expected "${testCase.expect.status}"`);
  const all = JSON.stringify(a);
  const searchable = a.status === "ok" ? [a.formula, a.appliesTo, ...a.stepsExcel, ...a.stepsSheets, ...a.notes].join("\n") : a.message;
  // mustContain: regexes (with alternatives) over the formula, range, steps and notes; mustNotContain: regexes over the formula.
  const artifact = a.status === "ok" ? a.formula : a.message;
  for (const s of testCase.expect.mustContain) if (!new RegExp(s, "i").test(searchable)) problems.push(`missing /${s}/`);
  for (const s of testCase.expect.mustNotContain) if (new RegExp(s, "i").test(artifact)) problems.push(`must not contain /${s}/`);
  for (const probe of LEAK_PROBES) if (all.includes(probe)) problems.push("quotes the system prompt");
  if (a.status === "ok") {
    if (testCase.expect.kind && a.kind !== testCase.expect.kind) problems.push(`kind is ${a.kind}, expected ${testCase.expect.kind}`);
    for (const w of ruleWarnings(a.formula, a.appliesTo, testCase.input.platform, testCase.input.range)) problems.push(`check: ${w}`);
  }
  return problems;
}
