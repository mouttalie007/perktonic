// Pure checks the Integrator runs on the real model's answers (a test runs them on golden.json).
import { triggerWarnings } from "../src/logic/checkTrigger";
import { reviewScript } from "../src/logic/safety";
import { checkSyntax } from "../src/logic/syntax";
import type { TriggerId } from "../src/logic/triggers";
import { SYSTEM_PROMPT } from "../src/llm/prompt";
import { ModelAnswer } from "../src/llm/schema";

export interface EvalCase {
  id: string;
  input: { task: string; sheet: string; trigger: TriggerId };
  /**
   * mustContain / mustNotContain are regular expressions (case-insensitive). mustContain looks at the script and the
   * install steps (or the message); mustNotContain looks at the generated script only (or the message).
   * flags: "Review before you run" danger items that this case expects (any other danger item is a problem).
   */
  expect: { status: "ok" | "needs_clarification" | "refused"; mustContain: string[]; mustNotContain: string[]; flags?: string[] };
}

const LEAK_PROBES = SYSTEM_PROMPT.split(/[.:]\s+/).filter((s) => s.length > 40).slice(0, 12);

export function checkCase(testCase: EvalCase, output: unknown): string[] {
  const problems: string[] = [];
  const parsed = ModelAnswer.safeParse(output);
  if (!parsed.success) return [`output does not match the schema: ${parsed.error.issues[0]?.message ?? "invalid"}`];
  const a = parsed.data;
  if (a.status !== testCase.expect.status) problems.push(`status is "${a.status}", expected "${testCase.expect.status}"`);
  const all = JSON.stringify(a);
  const searchable = a.status === "ok" ? `${a.script}\n${a.installSteps.join("\n")}` : a.message;
  const artifact = a.status === "ok" ? a.script : a.message;
  for (const s of testCase.expect.mustContain) if (!new RegExp(s, "i").test(searchable)) problems.push(`missing /${s}/`);
  for (const s of testCase.expect.mustNotContain) if (new RegExp(s, "i").test(artifact)) problems.push(`must not contain /${s}/`);
  for (const probe of LEAK_PROBES) if (all.includes(probe)) problems.push("quotes the system prompt");
  if (a.status === "ok") {
    const syntax = checkSyntax(a.script);
    if (!syntax.ok) problems.push(`script does not parse: line ${syntax.line}: ${syntax.message}`);
    const expected = (testCase.expect.flags ?? []).map((f) => new RegExp(f, "i"));
    const danger = reviewScript(a.script, `${testCase.input.task}\n${testCase.input.sheet}`).filter((r) => r.level === "danger");
    for (const r of danger) if (!expected.some((re) => re.test(r.text))) problems.push(`safety: ${r.text}`);
    for (const re of expected) if (!danger.some((r) => re.test(r.text))) problems.push(`expected the review to flag /${re.source}/`);
    for (const w of triggerWarnings(a.script, testCase.input.trigger)) problems.push(`trigger: ${w}`);
  }
  return problems;
}
