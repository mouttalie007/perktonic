// Pure checks the Integrator runs on the real model's answers (a test runs them on golden.json).
// mustContain / mustNotContain are case-insensitive regular expressions over the minutes without
// their quotes (the generated text); for refusals they apply to the message.
import { buildResult } from "../src/logic/result";
import type { PromptInput } from "../src/llm/prompt";
import { SYSTEM_PROMPT } from "../src/llm/prompt";
import { ModelAnswer } from "../src/llm/schema";

export interface EvalCase {
  id: string;
  input: PromptInput;
  expect: {
    status: "ok" | "needs_clarification" | "refused";
    mustContain: string[];
    mustNotContain: string[];
    /** Names that must own at least one action item. */
    owners?: string[];
    /** Action item (task matched by this expression) → expected due date (null = no date). */
    dues?: Record<string, string | null>;
    attendees?: string[];
    counts?: Partial<Record<"decisions" | "actionItems" | "openQuestions", number>>;
    title?: string;
    date?: string;
    language?: "fr";
  };
}

const LEAK_PROBES = SYSTEM_PROMPT.split(/[.:]\s+/).filter((s) => s.length > 40);
const FRENCH = /\b(le|la|les|des|du|est|et|pour|sera|une)\b/gi;

export function checkCase(testCase: EvalCase, output: unknown): string[] {
  const problems: string[] = [];
  const parsed = ModelAnswer.safeParse(output);
  if (!parsed.success) return [`output does not match the schema: ${parsed.error.issues[0]?.message ?? "invalid"}`];
  const a = parsed.data;
  const e = testCase.expect;
  if (a.status !== e.status) problems.push(`status is "${a.status}", expected "${e.status}"`);
  const strip = <T extends { quote: string }>(xs: T[]) => xs.map((x) => Object.fromEntries(Object.entries(x).filter(([k]) => k !== "quote")));
  const artifact = a.status === "ok" ? JSON.stringify({ ...a, decisions: strip(a.decisions), actionItems: strip(a.actionItems), openQuestions: strip(a.openQuestions) }) : a.message;
  for (const s of e.mustContain) if (!new RegExp(s, "i").test(artifact)) problems.push(`missing /${s}/`);
  for (const s of e.mustNotContain) if (new RegExp(s, "i").test(artifact)) problems.push(`must not contain /${s}/`);
  for (const probe of LEAK_PROBES) if (JSON.stringify(a).includes(probe)) problems.push("quotes the system prompt");
  if (a.status !== "ok") return problems;
  const r = buildResult(a, testCase.input, false);
  if (r.status !== "ok") return problems;
  const adj = r.adjustments;
  if (adj.droppedDecisions + adj.droppedActions + adj.droppedQuestions) problems.push(`${adj.droppedDecisions + adj.droppedActions + adj.droppedQuestions} item(s) quote text that is not in the transcript`);
  if (adj.attendeesRemoved) problems.push(`${adj.attendeesRemoved} attendee(s) not named in the transcript`);
  if (adj.ownersCleared) problems.push(`${adj.ownersCleared} owner(s) not named in the transcript`);
  if (adj.datesCleared) problems.push(`${adj.datesCleared} due date(s) invalid or more than 5 years away`);
  if (adj.datesCorrected) problems.push(`${adj.datesCorrected} due date(s) differ from our own reading of the deadline words`);
  if (adj.titleCleared || adj.dateCleared) problems.push("a title or a date that is not in the transcript or the form");
  for (const o of e.owners ?? []) if (!r.actionItems.some((i) => i.owner && new RegExp(o, "i").test(i.owner))) problems.push(`no action item owned by ${o}`);
  for (const [task, due] of Object.entries(e.dues ?? {})) {
    const item = r.actionItems.find((i) => new RegExp(task, "i").test(i.task));
    if (!item) problems.push(`no action item matching /${task}/`);
    else if (item.dueDate !== due) problems.push(`/${task}/ is due ${item.dueDate}, expected ${due}`);
  }
  for (const n of e.attendees ?? []) if (!r.attendees.some((x) => new RegExp(n, "i").test(x.name))) problems.push(`attendee ${n} missing`);
  for (const [k, n] of Object.entries(e.counts ?? {})) if (r[k as "decisions"].length !== n) problems.push(`${r[k as "decisions"].length} ${k}, expected ${n}`);
  if (e.title && r.title !== e.title) problems.push(`title "${r.title}", expected the form's title`);
  if (e.date && r.date !== e.date) problems.push(`date ${r.date}, expected the form's date`);
  if (e.language === "fr" && (r.agenda.map((x) => x.summary).join(" ").match(FRENCH) ?? []).length < 3) problems.push("the minutes are not in French");
  return problems;
}
