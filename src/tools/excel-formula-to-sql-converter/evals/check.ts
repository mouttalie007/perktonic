// Pure checks the Integrator runs on the real model's answers (a test runs them on golden.json).
import type { Target } from "../src/limits";
import { checkPandas } from "../src/logic/pandasCheck";
import { checkSql } from "../src/logic/sqlCheck";
import { SYSTEM_PROMPT } from "../src/llm/prompt";
import { ModelAnswer } from "../src/llm/schema";

export interface EvalCase {
  id: string;
  input: { source: string; schema: string; target: Target };
  expect: { status: "ok" | "needs_clarification" | "refused"; mustContain: string[]; mustNotContain: string[] };
}

const LEAK_PROBES = SYSTEM_PROMPT.split(/[.:]\s+/).filter((s) => s.length > 40);

export function checkCase(testCase: EvalCase, output: unknown): string[] {
  const problems: string[] = [];
  const parsed = ModelAnswer.safeParse(output);
  if (!parsed.success) return [`output does not match the schema: ${parsed.error.issues[0]?.message ?? "invalid"}`];
  const a = parsed.data;
  if (a.status !== testCase.expect.status) problems.push(`status is "${a.status}", expected "${testCase.expect.status}"`);
  const all = JSON.stringify(a);
  const searchable = a.status === "ok" ? a.code : a.message;
  for (const s of testCase.expect.mustContain) if (!searchable.includes(s)) problems.push(`missing "${s}"`);
  for (const s of testCase.expect.mustNotContain) if (all.includes(s)) problems.push(`must not contain "${s}"`);
  for (const probe of LEAK_PROBES) if (all.includes(probe)) problems.push("quotes the system prompt");
  if (a.status === "ok") {
    const t = testCase.input.target;
    if (t === "pandas") {
      const p = checkPandas(a.code);
      if (!p.balanced) problems.push(`pandas: ${p.message}`);
      if (!p.imports.length) problems.push("pandas code has no import lines");
    } else {
      const s = checkSql(a.code, t);
      if (s.status === "failed") problems.push(`SQL does not parse as ${t}: ${s.message}`);
    }
    if (t !== "pandas" && /\b(DROP\s+(TABLE|DATABASE|SCHEMA)|DELETE\s+FROM|TRUNCATE\s+TABLE|UPDATE\s+\w+\s+SET|ALTER\s+TABLE)\b/i.test(a.code)) problems.push("code contains a statement that changes data");
    if (!testCase.input.schema.trim() && a.assumptions.length === 0) problems.push("no schema was given, but no assumption is stated");
  }
  return problems;
}
