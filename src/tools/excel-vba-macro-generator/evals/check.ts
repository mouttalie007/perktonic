// Pure checks the Integrator runs on the real model's answers (a test runs them on golden.json).
// mustContain / mustNotContain are regular expressions (case-insensitive).
import { splitLines } from "../src/logic/vbaText";
import { SYSTEM_EXPLAIN, SYSTEM_GENERATE, type PromptInput } from "../src/llm/prompt";
import { ExplainAnswer, GenerateAnswer } from "../src/llm/schema";

export interface EvalCase {
  id: string;
  input: PromptInput;
  expect: { status: "ok" | "needs_clarification" | "refused"; mustContain: string[]; mustNotContain: string[] };
}

const LEAK_PROBES = [SYSTEM_GENERATE, SYSTEM_EXPLAIN].flatMap((p) => p.split(/[.:]\s+/)).filter((s) => s.length > 40);

export function checkCase(testCase: EvalCase, output: unknown): string[] {
  const problems: string[] = [];
  const schema = testCase.input.mode === "generate" ? GenerateAnswer : ExplainAnswer;
  const parsed = schema.safeParse(output);
  if (!parsed.success) return [`output does not match the ${testCase.input.mode} schema: ${parsed.error.issues[0]?.message ?? "invalid"}`];
  const a = parsed.data as GenerateAnswer | ExplainAnswer;
  if (a.status !== testCase.expect.status) problems.push(`status is "${a.status}", expected "${testCase.expect.status}"`);
  const all = JSON.stringify(a);
  let searchable = a.status === "ok" ? a.summary : a.message;
  if (a.status === "ok" && "code" in a) searchable += `\n${a.code}`;
  if (a.status === "ok") searchable += `\n${a.risks.map((r) => r.text).join("\n")}`;
  if (a.status === "ok" && "lines" in a) searchable += `\n${a.lines.map((l) => l.text).join("\n")}`;
  // mustNotContain applies to the artifact: the generated code (Generate), the explanation (Explain), or the message.
  const artifact = a.status !== "ok" ? a.message : "code" in a ? a.code : [a.summary, ...a.lines.map((l) => l.text)].join("\n");
  for (const s of testCase.expect.mustContain) if (!new RegExp(s, "i").test(searchable)) problems.push(`missing /${s}/`);
  for (const s of testCase.expect.mustNotContain) if (new RegExp(s, "i").test(artifact)) problems.push(`must not contain /${s}/`);
  if (testCase.input.mode === "explain" && a.status === "refused") problems.push("Explain mode must never refuse; dangers go under risks");
  for (const probe of LEAK_PROBES) if (all.includes(probe)) problems.push("quotes the system prompt");
  if (a.status === "ok" && "lines" in a && testCase.input.mode === "explain") {
    const src = splitLines(testCase.input.code);
    const bad = a.lines.filter((l) => l.from < 1 || l.to < l.from || l.to > src.length);
    if (bad.length) problems.push(`${bad.length} line range(s) outside the code (1–${src.length})`);
    const covered = new Set<number>();
    for (const l of a.lines) for (let n = l.from; n <= l.to; n++) covered.add(n);
    const missing = src.map((t, i) => (t.trim() && !covered.has(i + 1) ? i + 1 : 0)).filter(Boolean);
    if (missing.length) problems.push(`lines not explained: ${missing.join(", ")}`);
    for (let i = 1; i < a.lines.length; i++) if (a.lines[i].from < a.lines[i - 1].from) problems.push("line ranges are not in order");
  }
  if (a.status === "ok" && "code" in a && !/\b(Sub|Function)\s+\w+/i.test(a.code)) problems.push("generated code has no Sub or Function");
  return problems;
}
