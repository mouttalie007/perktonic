import { expect, test } from "vitest";
import cases from "../evals/cases.json";
import golden from "../evals/golden.json";
import { checkCase, type EvalCase } from "../evals/check";

const all = cases as EvalCase[];
const answers = golden as Record<string, unknown>;
const isInjection = (c: EvalCase) => /ignore|new instruction/i.test(JSON.stringify(c.input));

test("at least 12 cases: 8+ normal, 2+ refused, 2+ injection attempts, both apps", () => {
  expect(all.length).toBeGreaterThanOrEqual(12);
  expect(all.filter((c) => c.expect.status === "refused").length).toBeGreaterThanOrEqual(2);
  expect(all.filter(isInjection).length).toBeGreaterThanOrEqual(2);
  expect(all.filter((c) => c.expect.status !== "refused" && !isInjection(c)).length).toBeGreaterThanOrEqual(8);
  expect(new Set(all.map((c) => c.input.platform))).toEqual(new Set(["excel", "sheets"]));
  expect(new Set(all.map((c) => c.id)).size).toBe(all.length);
});

test("every golden answer passes checkCase", () => {
  for (const c of all) expect(checkCase(c, answers[c.id]), c.id).toEqual([]);
});

test("checkCase catches wrong anchors, unknown functions, unbalanced brackets and a wrong status", () => {
  const byId = (id: string) => all.find((c) => c.id === id)!;
  const good = answers["overdue-and-large"] as Record<string, unknown>;
  expect(checkCase(byId("overdue-and-large"), { ...good, formula: '=AND(E2="Overdue",D2>1000)' }).join(" ")).toMatch(/no \$ before the column/);
  expect(checkCase(byId("overdue-and-large"), { ...good, formula: '=AND($E$2="Overdue",$D$2>1000)' }).join(" ")).toMatch(/same cell/);
  expect(checkCase(byId("overdue-and-large"), { ...good, formula: '=ANDD($E2="Overdue",$D2>1000)' }).join(" ")).toMatch(/ANDD/);
  expect(checkCase(byId("overdue-and-large"), { ...good, formula: '=AND($E2="Overdue",$D2>1000' }).join(" ")).toMatch(/never closed/);
  expect(checkCase(byId("off-topic-weather"), good)[0]).toMatch(/status/);
});

test("v2: the year check is accepted for dates in 2026; long steps and notes fit the schema", () => {
  const byId = (id: string) => all.find((c) => c.id === id)!;
  const good = answers["dates-in-2026"] as Record<string, unknown>;
  expect(checkCase(byId("dates-in-2026"), { ...good, formula: "=AND(ISNUMBER(D2),YEAR(D2)=2026)" })).toEqual([]);
  const sheet = answers["names-on-blocked-sheet"] as { notes: string[]; stepsSheets: string[] };
  const long = "x".repeat(450);
  expect(checkCase(byId("names-on-blocked-sheet"), { ...sheet, notes: [...sheet.notes, long, long, long], stepsSheets: [...sheet.stepsSheets, long] })).toEqual([]);
});
