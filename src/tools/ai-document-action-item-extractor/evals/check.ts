// Pure checks the Integrator runs on the real model's answers (a test runs them on golden.json).
import { MAX_YEARS_FROM_REFERENCE } from "../src/limits";
import { resolveDue, withinWindow } from "../src/logic/dates";
import { containsCollapsed } from "../src/logic/text";
import { SYSTEM_PROMPT } from "../src/llm/prompt";
import { ModelAnswer } from "../src/llm/schema";

export interface EvalCase {
  id: string;
  input: { text: string; referenceDate: string };
  /**
   * mustContain: regexes over tasks, owners and quotes; mustNotContain: regexes over the extracted items.
   * owners: regexes that must each match the owner of at least one item. sharedQuotes: how many quotes may be shared.
   */
  expect: { status: "ok" | "needs_clarification" | "refused"; mustContain: string[]; mustNotContain: string[]; owners?: string[]; sharedQuotes?: number };
}

const LEAK_PROBES = SYSTEM_PROMPT.split(/[.:]\s+/).filter((s) => s.length > 40);

export function checkCase(testCase: EvalCase, output: unknown): string[] {
  const problems: string[] = [];
  const parsed = ModelAnswer.safeParse(output);
  if (!parsed.success) return [`output does not match the schema: ${parsed.error.issues[0]?.message ?? "invalid"}`];
  const a = parsed.data;
  if (a.status !== testCase.expect.status) problems.push(`status is "${a.status}", expected "${testCase.expect.status}"`);
  const all = JSON.stringify(a);
  const searchable = a.status === "ok" ? a.items.map((i) => `${i.task}\n${i.owner ?? ""}\n${i.quote}`).join("\n") : a.message;
  // mustNotContain applies to the extracted items (the artifact), or to the message.
  const artifact = a.status === "ok" ? JSON.stringify(a.items) : a.message;
  for (const s of testCase.expect.mustContain) if (!new RegExp(s, "i").test(searchable)) problems.push(`missing /${s}/`);
  for (const s of testCase.expect.mustNotContain) if (new RegExp(s, "i").test(artifact)) problems.push(`must not contain /${s}/`);
  for (const probe of LEAK_PROBES) if (all.includes(probe)) problems.push("quotes the system prompt");
  if (a.status === "ok") {
    const { text, referenceDate } = testCase.input;
    const quotes = a.items.map((i) => i.quote.replace(/\s+/g, " ").trim());
    const repeated = [...new Set(quotes.filter((q, i) => quotes.indexOf(q) !== i))];
    if (repeated.length > (testCase.expect.sharedQuotes ?? 0)) problems.push(`${repeated.length} quote(s) used by more than one item (one item per distinct task)`);
    for (const o of testCase.expect.owners ?? []) if (!a.items.some((i) => i.owner && new RegExp(o, "i").test(i.owner))) problems.push(`no item owned by /${o}/`);
    a.items.forEach((item, n) => {
      const at = `item ${n + 1}`;
      if (!containsCollapsed(text, item.quote)) problems.push(`${at}: quote is not in the text`);
      if (item.owner !== null && !containsCollapsed(text, item.owner, true)) problems.push(`${at}: owner "${item.owner}" is not in the text (invented)`);
      if (item.dueDate !== null && !withinWindow(item.dueDate, referenceDate, MAX_YEARS_FROM_REFERENCE)) problems.push(`${at}: dueDate ${item.dueDate} is not a valid date within ${MAX_YEARS_FROM_REFERENCE} years`);
      if (item.dueDate !== null && item.dueText === null) problems.push(`${at}: a dueDate without the words it came from`);
      const ours = resolveDue(item.dueText, referenceDate);
      if (ours && item.dueDate !== ours) problems.push(`${at}: "${item.dueText}" resolves to ${ours}, not ${item.dueDate}`);
    });
  }
  return problems;
}
