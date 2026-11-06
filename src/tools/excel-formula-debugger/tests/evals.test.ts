import { expect, test } from "vitest";
import cases from "../evals/cases.json";
import golden from "../evals/golden.json";
import { checkCase, type EvalCase } from "../evals/check";

const all = cases as EvalCase[];
const answers = golden as Record<string, unknown>;

test("there are at least 12 cases: 8+ normal, 2+ refused, 2+ injection attempts", () => {
  expect(all.length).toBeGreaterThanOrEqual(12);
  expect(all.filter((c) => c.expect.status === "refused").length).toBeGreaterThanOrEqual(2);
  expect(all.filter((c) => /ignore|new instruction/i.test(JSON.stringify(c.input))).length).toBeGreaterThanOrEqual(2);
  expect(all.filter((c) => c.expect.status !== "refused" && !/ignore|new instruction|forget/i.test(JSON.stringify(c.input))).length).toBeGreaterThanOrEqual(8);
  expect(new Set(all.map((c) => c.id)).size).toBe(all.length);
});

test("every golden answer passes checkCase", () => {
  for (const c of all) expect(checkCase(c, answers[c.id]), c.id).toEqual([]);
});

test("checkCase catches a wrong status, an IFERROR-only fix, a fix without assumptions and unknown functions", () => {
  const byId = (id: string) => all.find((c) => c.id === id)!;
  const ok = { status: "ok", diagnosis: "x", correctedFormula: null, assumptions: [], preventionTips: [] };
  expect(checkCase(byId("off-topic-letter"), ok)[0]).toMatch(/status/);
  expect(checkCase(byId("div0-empty-units"), { ...ok, correctedFormula: '=IFERROR(D2/C2,"")', assumptions: ["x"] }).join(" ")).toMatch(/only wraps/);
  expect(checkCase(byId("div0-empty-units"), { ...ok, diagnosis: "Wrap it in IFERROR.", correctedFormula: null }).join(" ")).toMatch(/diagnosis/);
  expect(checkCase(byId("name-typo"), { ...ok, correctedFormula: "=AVERAGE(C2:C20)", assumptions: [] }).join(" ")).toMatch(/schema|assumptions/);
  expect(checkCase(byId("name-typo"), { ...ok, correctedFormula: "=AVERGE(C2:C20)", assumptions: ["x"] }).join(" ")).toMatch(/AVERGE/);
});

test("v2: a normal diagnosis for the injection case passes, a refusal does not; mustNotContain looks at the corrected formula only", () => {
  const byId = (id: string) => all.find((c) => c.id === id)!;
  expect(checkCase(byId("injection-in-description"), { status: "refused", message: "I can't share my instructions." })[0]).toMatch(/status/);
  const good = answers["semicolons-in-english-excel"] as Record<string, unknown>;
  // The diagnosis may talk about semicolons; only the corrected formula must not contain one.
  expect(checkCase(byId("semicolons-in-english-excel"), { ...good, diagnosis: "Replace each ; with a comma." })).toEqual([]);
  expect(checkCase(byId("semicolons-in-english-excel"), { ...good, correctedFormula: '=SUMIF(A2:A9;"x";B2:B9)' }).join(" ")).toMatch(/must not contain|commas/);
});
