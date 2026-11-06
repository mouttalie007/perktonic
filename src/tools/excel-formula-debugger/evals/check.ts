// Pure checks the Integrator runs on the real model's answers (a test runs them on golden.json).
// mustContain / mustNotContain are regular expressions (case-insensitive), so alternative wordings pass.
import { checkFormula, type Platform } from "../src/logic/checks";
import { parseFormula } from "../src/logic/parse";
import type { ErrorKind } from "../src/logic/rules";
import { SYSTEM_PROMPT } from "../src/llm/prompt";
import { ModelAnswer } from "../src/llm/schema";

export interface EvalCase {
  id: string;
  input: { formula: string; error: ErrorKind; platform: Platform; cell: string; description: string };
  expect: { status: "ok" | "needs_clarification" | "refused"; mustContain: string[]; mustNotContain: string[] };
}

const LEAK_PROBES = SYSTEM_PROMPT.split(/[.:]\s+/).filter((s) => s.length > 40).slice(0, 12);

function top(f: string): string | null {
  try {
    const { ast } = parseFormula(f);
    return ast.type === "call" ? ast.name : null;
  } catch {
    return null;
  }
}

export function checkCase(testCase: EvalCase, output: unknown): string[] {
  const problems: string[] = [];
  const parsed = ModelAnswer.safeParse(output);
  if (!parsed.success) return [`output does not match the schema: ${parsed.error.issues[0]?.message ?? "invalid"}`];
  const a = parsed.data;
  if (a.status !== testCase.expect.status) problems.push(`status is "${a.status}", expected "${testCase.expect.status}"`);
  const prose = a.status === "ok" ? [a.diagnosis, ...a.assumptions, ...a.preventionTips].join("\n") : a.message;
  const searchable = a.status === "ok" ? `${a.diagnosis}\n${a.correctedFormula ?? ""}\n${a.assumptions.join("\n")}\n${a.preventionTips.join("\n")}` : a.message;
  // mustNotContain applies to the generated artifact (the corrected formula), or to the message when there is none.
  const artifact = a.status === "ok" ? (a.correctedFormula ?? "") : a.message;
  for (const s of testCase.expect.mustContain) if (!new RegExp(s, "i").test(searchable)) problems.push(`missing /${s}/`);
  for (const s of testCase.expect.mustNotContain) if (new RegExp(s, "i").test(artifact)) problems.push(`must not contain /${s}/`);
  for (const probe of LEAK_PROBES) if (prose.includes(probe)) problems.push("quotes the system prompt");
  if (a.status === "ok") {
    const originalWrapped = ["IFERROR", "IFNA"].includes(top(testCase.input.formula) ?? "");
    if (a.correctedFormula) {
      const c = checkFormula(a.correctedFormula, testCase.input.platform);
      if (c.parseError) problems.push(`corrected formula does not parse: ${c.parseError.message}`);
      if (c.unknownFunctions.length) problems.push(`corrected formula uses unknown functions: ${c.unknownFunctions.join(", ")}`);
      if (c.separator === "semicolon" || c.separator === "mixed") problems.push("corrected formula must use commas");
      if (!originalWrapped && ["IFERROR", "IFNA"].includes(top(a.correctedFormula) ?? "")) problems.push("the correction only wraps the formula in IFERROR/IFNA");
      if (a.assumptions.length === 0) problems.push("a correction without assumptions");
    }
    if (!originalWrapped && /\b(IFERROR|IFNA)\b/.test(a.diagnosis)) problems.push("IFERROR/IFNA appears in the diagnosis (it may only be a tip)");
  }
  return problems;
}
