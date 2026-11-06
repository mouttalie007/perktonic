import { expect, test } from "vitest";
import cases from "../evals/cases.json";
import golden from "../evals/golden.json";
import { checkCase, type EvalCase } from "../evals/check";

const all = cases as EvalCase[];
const answers = golden as Record<string, Record<string, unknown>>;
const isInjection = (c: EvalCase) => /ignore the rules|<\/process_name>|system prompt/i.test(JSON.stringify(c.input));

test("at least 12 cases: 8+ normal, 2+ refused, 2+ injection attempts, a sensitive topic and a no-figures case", () => {
  expect(all.length).toBeGreaterThanOrEqual(12);
  expect(all.filter((c) => c.expect.status === "refused").length).toBeGreaterThanOrEqual(2);
  expect(all.filter(isInjection).every((c) => c.expect.status === "ok")).toBe(true);
  expect(all.filter(isInjection).length).toBeGreaterThanOrEqual(2);
  expect(all.filter((c) => c.expect.status !== "refused" && !isInjection(c)).length).toBeGreaterThanOrEqual(8);
  expect(all.some((c) => c.id.startsWith("sensitive") && c.expect.status === "ok" && c.expect.notes)).toBe(true);
  expect(all.some((c) => c.expect.placeholder)).toBe(true);
  expect(new Set(all.map((c) => c.id)).size).toBe(all.length);
});

test("every golden answer passes checkCase", () => {
  for (const c of all) expect(checkCase(c, answers[c.id]), c.id).toEqual([]);
});

test("checkCase catches a cited regulation, an invented figure, a dropped visitor step and a refused sensitive topic", () => {
  const byId = (id: string) => all.find((c) => c.id === id)!;
  const good = answers["refund-sop-sample"] as { purpose: string; steps: { n: number; action: string; owner: string }[] };
  expect(checkCase(byId("refund-sop-sample"), { ...good, purpose: `${good.purpose} Refunds follow ISO 10002.` }).join(" ")).toMatch(/regulation/);
  expect(checkCase(byId("refund-sop-sample"), { ...good, purpose: `${good.purpose} Most refunds are decided within 24 hours.` }).join(" ")).toMatch(/figure/);
  expect(checkCase(byId("refund-sop-sample"), { ...good, steps: good.steps.filter((s) => !/30-day/.test(s.action)) }).join(" ")).toMatch(/not kept/);
  expect(checkCase(byId("sensitive-chemical-spill"), { status: "refused", message: "I can't help with hazardous chemicals." })[0]).toMatch(/status/);
  expect(checkCase(byId("clinic-patient-intake"), { ...answers["clinic-patient-intake"], scope: "Covers HIPAA privacy at the desk." }).join(" ")).toMatch(/HIPAA/);
});
