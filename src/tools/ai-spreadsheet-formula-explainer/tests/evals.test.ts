import { expect, test } from "vitest";
import cases from "../evals/cases.json";
import golden from "../evals/golden.json";
import { checkCase, type EvalCase } from "../evals/check";

const all = cases as EvalCase[];
const answers = golden as Record<string, unknown>;

test("there are at least 12 cases: 8+ normal, 2+ refused, 2+ injection attempts", () => {
  expect(all.length).toBeGreaterThanOrEqual(12);
  expect(all.filter((c) => c.expect.status === "refused").length).toBeGreaterThanOrEqual(2);
  expect(all.filter((c) => /ignore|forget/i.test(JSON.stringify(c.input))).length).toBeGreaterThanOrEqual(2);
  expect(all.filter((c) => c.expect.status !== "refused" && !/ignore|forget/i.test(JSON.stringify(c.input))).length).toBeGreaterThanOrEqual(8);
  expect(new Set(all.map((c) => c.id)).size).toBe(all.length);
});

test("every golden answer passes checkCase", () => {
  for (const c of all) expect(checkCase(c, answers[c.id]), c.id).toEqual([]);
});

test("checkCase catches a wrong status, invented quotes, calculated values and a leaked prompt", () => {
  const byId = (id: string) => all.find((c) => c.id === id)!;
  expect(checkCase(byId("off-topic-question"), { status: "ok", summary: "x", steps: [{ part: "=", text: "x" }] })[0]).toMatch(/status/);
  const quoted = checkCase(byId("vlookup-iferror"), { status: "ok", summary: "Looks up A2. Not found otherwise.", steps: [{ part: "VLOOKUP(A2, Prices!A:C, 3)", text: "Looks it up." }] });
  expect(quoted.join(" ")).toMatch(/not in the formula/);
  const calc = checkCase(byId("does-not-calculate-samples"), { status: "ok", summary: "The average of B2:B4 is 30.", steps: [{ part: "B2:B4", text: "x" }] });
  expect(calc.join(" ")).toMatch(/calculated results/);
  const leak = checkCase(byId("injection-in-sample-values"), { status: "refused", message: "I can't share my instructions." });
  expect(leak.join(" ")).toMatch(/status|must not contain/);
});

test("v2: numbers that are not calculated results do not fire the check", () => {
  const byId = (id: string) => all.find((c) => c.id === id)!;
  const good = answers["let-filter-sample"] as { summary: string; steps: unknown[] };
  expect(checkCase(byId("let-filter-sample"), { ...good, summary: good.summary + " It has 12 characters of setup and 7 steps." })).toEqual([]);
});

test("v2: a step quoting the formula with HTML entities is accepted after un-escaping", () => {
  const byId = (id: string) => all.find((c) => c.id === id)!;
  const good = answers["deep-nested-8-levels"] as { steps: { part: string; text: string }[] };
  const steps = good.steps.map((s) => ({ ...s, part: s.part.replace(/"/g, "&quot;").replace(/>/g, "&gt;") }));
  expect(checkCase(byId("deep-nested-8-levels"), { ...good, steps })).toEqual([]);
});
