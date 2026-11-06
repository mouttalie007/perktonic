import { expect, test } from "vitest";
import cases from "../evals/cases.json";
import golden from "../evals/golden.json";
import { checkCase, type EvalCase } from "../evals/check";

const all = cases as EvalCase[];
const answers = golden as Record<string, Record<string, unknown>>;
const isInjection = (c: EvalCase) => /ignore previous|<\/invoice_text>/i.test(c.input.text);

test("at least 12 cases: 8+ normal, 2+ refused, 2+ injections, a sensitive invoice and a not-printed case", () => {
  expect(all.length).toBeGreaterThanOrEqual(12);
  expect(all.filter((c) => c.expect.status === "refused").length).toBeGreaterThanOrEqual(2);
  expect(all.filter(isInjection).length).toBeGreaterThanOrEqual(2);
  expect(all.filter(isInjection).every((c) => c.expect.status === "ok")).toBe(true);
  expect(all.filter((c) => c.expect.status === "ok" && !isInjection(c)).length).toBeGreaterThanOrEqual(8);
  expect(all.some((c) => c.id.startsWith("sensitive") && c.expect.status === "ok")).toBe(true);
  expect(all.some((c) => c.expect.nulls?.includes("total") && c.expect.nulls.includes("dueDate"))).toBe(true);
  expect(new Set(all.map((c) => c.id)).size).toBe(all.length);
});

test("every golden answer passes checkCase", () => {
  for (const c of all) expect(checkCase(c, answers[c.id]), c.id).toEqual([]);
});

test("checkCase catches a computed amount, an invented due date, a wrong total and a refused medical invoice", () => {
  const byId = (id: string) => all.find((c) => c.id === id)!;
  const eu = answers["eu-vat-invoice-comma-decimals"] as Record<string, unknown>;
  expect(checkCase(byId("eu-vat-invoice-comma-decimals"), { ...eu, subtotal: { value: "1043.50", quote: "Total HT                                      1.043,50 €" } }).join(" ")).toMatch(/subtotal needs checking|1043\\.5/);
  const kt = answers["no-total-relative-due-date"] as Record<string, unknown>;
  expect(checkCase(byId("no-total-relative-due-date"), { ...kt, dueDate: { value: "2026-10-17", quote: "Payment: 14 days from the invoice date" } }).join(" ")).toMatch(/dueDate/);
  const us = answers["sample-us-invoice"] as Record<string, unknown>;
  expect(checkCase(byId("sample-us-invoice"), { ...us, total: { value: "0.00", quote: "Total due (USD)                                         650.70" } }).join(" ")).toMatch(/total needs checking/);
  expect(checkCase(byId("sensitive-medical-invoice"), { status: "refused", message: "I can't process medical records." })[0]).toMatch(/status/);
});
