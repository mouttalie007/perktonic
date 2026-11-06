// Pure checks the Integrator runs on the real model's answers (a test runs them on golden.json).
// mustContain / mustNotContain are regular expressions (case-insensitive) over the generated summary,
// key points and digest; mustNotContain applies to that generated text only (or to the message).
import { checkFigures, sourceDigits } from "../src/logic/figures";
import { containsCollapsed } from "../src/logic/text";
import type { LengthId, ToneId } from "../src/limits";
import { SYSTEM_PROMPT } from "../src/llm/prompt";
import { ModelAnswer } from "../src/llm/schema";

export interface EvalCase {
  id: string;
  input: { text: string; length: LengthId; tone: ToneId; sections: boolean };
  expect: { status: "ok" | "needs_clarification" | "refused"; mustContain: string[]; mustNotContain: string[]; language?: "fr" | "es" };
}

const LEAK_PROBES = SYSTEM_PROMPT.split(/[.:]\s+/).filter((s) => s.length > 40);
const STOPWORDS: Record<string, RegExp> = { fr: /\b(le|la|les|des|du|est|et|pour|dont)\b/gi, es: /\b(el|la|los|las|del|que|por|para|un|una)\b/gi };

export function checkCase(testCase: EvalCase, output: unknown): string[] {
  const problems: string[] = [];
  const parsed = ModelAnswer.safeParse(output);
  if (!parsed.success) return [`output does not match the schema: ${parsed.error.issues[0]?.message ?? "invalid"}`];
  const a = parsed.data;
  if (a.status !== testCase.expect.status) problems.push(`status is "${a.status}", expected "${testCase.expect.status}"`);
  const generated = a.status === "ok" ? [a.summary, ...a.keyPoints.map((k) => k.text), ...a.sections.map((s) => `${s.heading}\n${s.summary}`)].join("\n") : a.message;
  for (const s of testCase.expect.mustContain) if (!new RegExp(s, "i").test(generated)) problems.push(`missing /${s}/`);
  for (const s of testCase.expect.mustNotContain) if (new RegExp(s, "i").test(generated)) problems.push(`must not contain /${s}/`);
  for (const probe of LEAK_PROBES) if (JSON.stringify(a).includes(probe)) problems.push("quotes the system prompt");
  if (a.status === "ok") {
    const digits = sourceDigits(testCase.input.text);
    const missing = checkFigures(generated, digits).filter((f) => !f.found);
    if (missing.length) problems.push(`figures not in the text: ${missing.map((f) => f.text).join(", ")}`);
    const unverified = a.keyPoints.filter((k) => !containsCollapsed(testCase.input.text, k.quote));
    if (unverified.length) problems.push(`${unverified.length} key point quote(s) not found in the text`);
    if (a.keyPoints.length < 3 || a.keyPoints.length > 10) problems.push(`${a.keyPoints.length} key points (3 to 10 expected)`);
    if (testCase.input.sections && a.sections.length === 0) problems.push("the digest was asked for but sections is empty");
    if (!testCase.input.sections && a.sections.length > 0) problems.push("sections returned although the digest was not asked for");
    const sentences = a.summary.split(/[.!?](?:\s|$)/).filter((x) => x.trim()).length;
    const paragraphs = a.summary.split(/\n\s*\n/).filter((x) => x.trim()).length;
    if (testCase.input.length === "short" && sentences > 5) problems.push(`short summary has ${sentences} sentences`);
    if (testCase.input.length === "long" && paragraphs < 2) problems.push("long summary should have two paragraphs");
    const lang = testCase.expect.language;
    if (lang && (a.summary.match(STOPWORDS[lang]) ?? []).length < 3) problems.push(`summary is not in the document's language (${lang})`);
  }
  return problems;
}
