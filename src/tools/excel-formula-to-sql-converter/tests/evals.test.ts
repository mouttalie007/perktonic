import { expect, test } from "vitest";
import cases from "../evals/cases.json";
import golden from "../evals/golden.json";
import { checkCase, type EvalCase } from "../evals/check";

const all = cases as EvalCase[];
const answers = golden as Record<string, unknown>;
const isInjection = (c: EvalCase) => /ignore|new instruction/i.test(JSON.stringify(c.input));

test("at least 12 cases: 8+ normal, 2+ refused, 2+ injection attempts, all five targets", () => {
  expect(all.length).toBeGreaterThanOrEqual(12);
  expect(all.filter((c) => c.expect.status === "refused").length).toBeGreaterThanOrEqual(2);
  expect(all.filter(isInjection).length).toBeGreaterThanOrEqual(2);
  expect(all.filter((c) => c.expect.status !== "refused" && !isInjection(c)).length).toBeGreaterThanOrEqual(8);
  expect(new Set(all.map((c) => c.input.target))).toEqual(new Set(["postgresql", "mysql", "sqlite", "sqlserver", "pandas"]));
  expect(new Set(all.map((c) => c.id)).size).toBe(all.length);
});

test("every golden answer passes checkCase", () => {
  for (const c of all) expect(checkCase(c, answers[c.id]), c.id).toEqual([]);
});

test("checkCase catches SQL that does not parse, unbalanced pandas, destructive SQL and missing assumptions", () => {
  const byId = (id: string) => all.find((c) => c.id === id)!;
  const sql = answers["countifs-no-schema"] as Record<string, unknown>;
  expect(checkCase(byId("countifs-no-schema"), { ...sql, code: "SELEC COUNT(*) FROM tickets WHERE status = 'Open' AND priority > 5" }).join(" ")).toMatch(/does not parse as mysql/);
  expect(checkCase(byId("countifs-no-schema"), { ...sql, assumptions: [] }).join(" ")).toMatch(/no assumption/);
  expect(checkCase(byId("countifs-no-schema"), { ...sql, code: "SELECT COUNT(*) FROM tickets WHERE status = 'Open' AND priority > 5; DELETE FROM tickets;" }).join(" ")).toMatch(/changes data/);
  const pd = answers["if-chain-np-select"] as Record<string, unknown>;
  expect(checkCase(byId("if-chain-np-select"), { ...pd, code: String(pd.code).replace("default=\"F\")", "default=\"F\"") }).join(" ")).toMatch(/never closed/);
  expect(checkCase(byId("off-topic-joke"), sql)[0]).toMatch(/status/);
});
