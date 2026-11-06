// Pure checks the Integrator runs on the real model's answers (a test runs them on golden.json).
// mustContain / mustNotContain are case-insensitive regular expressions over the extracted data
// (every field except the notes); for refusals they apply to the message.
import { buildInvoice } from "../src/logic/result";
import type { PromptInput } from "../src/llm/prompt";
import { SYSTEM_PROMPT } from "../src/llm/prompt";
import { ModelAnswer } from "../src/llm/schema";
import type { Checked, Invoice } from "../src/types";

export interface EvalCase {
  id: string;
  input: PromptInput;
  expect: {
    status: "ok" | "needs_clarification" | "refused";
    mustContain: string[];
    mustNotContain: string[];
    /** Fields that must be null (not printed on the document). */
    nulls?: (keyof Invoice)[];
    /** Fields our checks may flag (paths like "vendor" or "lineItems.1.amount"); every other value must be verified. */
    checkFields?: string[];
    arithmetic?: Partial<Record<"lines_vs_subtotal" | "subtotal_plus_taxes_vs_total", "pass" | "fail" | "skipped">>;
    lineCount?: number;
    taxCount?: number;
    style?: Invoice["numberStyle"];
    /** A note must match this expression. */
    notes?: string;
  };
}

const LEAK_PROBES = SYSTEM_PROMPT.split(/[.:]\s+/).filter((s) => s.length > 40);

function flagged(inv: Invoice): string[] {
  const out: string[] = [];
  const see = (path: string, c: Checked) => c.status === "check" && out.push(path);
  for (const k of ["vendor", "vendorTaxId", "invoiceNumber", "invoiceDate", "dueDate", "currency", "subtotal", "total"] as const) see(k, inv[k]);
  inv.lineItems.forEach((l, i) => (["description", "quantity", "unitPrice", "amount"] as const).forEach((k) => see(`lineItems.${i}.${k}`, l[k])));
  inv.taxes.forEach((t, i) => see(`taxes.${i}.amount`, t.amount));
  return out;
}

export function checkCase(testCase: EvalCase, output: unknown): string[] {
  const problems: string[] = [];
  const parsed = ModelAnswer.safeParse(output);
  if (!parsed.success) return [`output does not match the schema: ${parsed.error.issues[0]?.message ?? "invalid"}`];
  const a = parsed.data;
  const e = testCase.expect;
  if (a.status !== e.status) problems.push(`status is "${a.status}", expected "${e.status}"`);
  const artifact = a.status === "ok" ? JSON.stringify({ ...a, notes: undefined }) : a.message;
  for (const s of e.mustContain) if (!new RegExp(s, "i").test(artifact)) problems.push(`missing /${s}/`);
  for (const s of e.mustNotContain) if (new RegExp(s, "i").test(artifact)) problems.push(`must not contain /${s}/`);
  for (const probe of LEAK_PROBES) if (JSON.stringify(a).includes(probe)) problems.push("quotes the system prompt");
  if (a.status !== "ok") return problems;
  const inv = buildInvoice(a, testCase.input);
  const allowed = new Set(e.checkFields ?? []);
  for (const f of flagged(inv)) if (!allowed.has(f)) problems.push(`${f} needs checking: our server could not verify it against the text`);
  for (const f of allowed) if (!flagged(inv).includes(f)) problems.push(`${f} should be flagged for checking`);
  for (const k of e.nulls ?? []) {
    const v = inv[k] as Checked;
    if (v.value !== null) problems.push(`${String(k)} must be null (not printed), got "${v.value}"`);
  }
  for (const [id, status] of Object.entries(e.arithmetic ?? {})) {
    const c = inv.checks.find((x) => x.id === id);
    if (c?.status !== status) problems.push(`arithmetic ${id} is ${c?.status ?? "absent"}, expected ${status}`);
  }
  const lineFails = inv.checks.filter((c) => c.id === "line" && c.status === "fail");
  if (lineFails.length) problems.push(`quantity × unit price fails on line ${lineFails.map((c) => c.line).join(", ")}`);
  if (e.lineCount !== undefined && a.lineItems.length !== e.lineCount) problems.push(`${a.lineItems.length} line items, expected ${e.lineCount}`);
  if (e.taxCount !== undefined && a.taxes.length !== e.taxCount) problems.push(`${a.taxes.length} tax lines, expected ${e.taxCount}`);
  if (e.style && inv.numberStyle !== e.style) problems.push(`number style ${inv.numberStyle}, expected ${e.style}`);
  if (e.notes && !a.notes.some((n) => new RegExp(e.notes!, "i").test(n))) problems.push(`no note matches /${e.notes}/`);
  return problems;
}
