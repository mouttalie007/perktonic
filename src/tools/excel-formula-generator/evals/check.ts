// Pure checks the Integrator runs on the real model's answers (and a test runs on golden.json).
import { checkFormula, type Platform } from "../src/logic/checks";
import { buildUser, SYSTEM_PROMPT } from "../src/llm/prompt";
import { ModelAnswer } from "../src/llm/schema";

export interface EvalCase {
  id: string;
  input: { request: string; platform: Platform; columns: string };
  expect: { status: "ok" | "needs_clarification" | "refused"; mustContain: string[]; mustNotContain: string[] };
}

/** Sentences of the system prompt long enough that quoting them means the prompt leaked. */
const LEAK_PROBES = SYSTEM_PROMPT.split(/[.:]\s+/).filter((s) => s.length > 40).slice(0, 12);

export function checkCase(testCase: EvalCase, output: unknown): string[] {
  const problems: string[] = [];
  const parsed = ModelAnswer.safeParse(output);
  if (!parsed.success) return [`output does not match the schema: ${parsed.error.issues[0]?.message ?? "invalid"}`];
  const a = parsed.data;
  const all = JSON.stringify(a);
  if (a.status !== testCase.expect.status) problems.push(`status is "${a.status}", expected "${testCase.expect.status}"`);

  const searchable = a.status === "ok" ? [a.formula, a.alternative?.formula ?? ""].join("\n") : a.message;
  for (const s of testCase.expect.mustContain) if (!searchable.toLowerCase().includes(s.toLowerCase())) problems.push(`missing "${s}"`);
  for (const s of testCase.expect.mustNotContain) if (all.toLowerCase().includes(s.toLowerCase())) problems.push(`must not contain "${s}"`);
  for (const probe of LEAK_PROBES) if (all.includes(probe)) problems.push("quotes the system prompt");
  // The user message is built for the model; a check that it still holds the tags keeps the case honest.
  if (!buildUser(testCase.input).includes("</request>")) problems.push("buildUser lost the request tags");

  if (a.status === "ok") {
    const platform = testCase.input.platform;
    for (const [label, formula] of [["formula", a.formula], ["alternative", a.alternative?.formula]] as const) {
      if (!formula) continue;
      const c = checkFormula(formula, platform);
      if (c.parseError) problems.push(`${label} does not parse: ${c.parseError.message}`);
      if (c.unknownFunctions.length) problems.push(`${label} uses functions not in the ${platform} list: ${c.unknownFunctions.join(", ")}`);
      if (c.separator !== "comma" && c.separator !== "none") problems.push(`${label} must separate arguments with commas`);
    }
    const old = platform === "excel2019" || platform === "libreoffice";
    const mainNew = checkFormula(a.formula, platform).newFunctions;
    if (old && mainNew.length) {
      const altNew = a.alternative ? checkFormula(a.alternative.formula, platform).newFunctions : mainNew;
      if (altNew.length) problems.push(`uses ${mainNew.join(", ")} on ${platform} without a fallback in "alternative"`);
    }
    const sentences = a.explanation.split(/[.!?]\s+(?=[A-Z])/).filter(Boolean).length;
    if (sentences > 3) problems.push(`explanation has ${sentences} sentences (max 3)`);
  } else if (a.status === "needs_clarification" && !a.message.includes("?")) {
    problems.push("a clarification must ask a question");
  }
  return problems;
}
