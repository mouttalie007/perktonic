import { expect, test } from "vitest";
import cases from "../evals/cases.json";
import golden from "../evals/golden.json";
import { checkCase, type EvalCase } from "../evals/check";

const all = cases as EvalCase[];
const answers = golden as Record<string, Record<string, unknown>>;
const isInjection = (c: EvalCase) => /ignore your rules|<\/transcript>/i.test(c.input.transcript);

test("at least 12 cases: 8+ normal, 2+ refused, 2+ injections, a sensitive meeting and a far or vague date", () => {
  expect(all.length).toBeGreaterThanOrEqual(12);
  expect(all.filter((c) => c.expect.status === "refused").length).toBeGreaterThanOrEqual(2);
  expect(all.filter(isInjection).length).toBeGreaterThanOrEqual(2);
  expect(all.filter(isInjection).every((c) => c.expect.status === "ok")).toBe(true);
  expect(all.filter((c) => c.expect.status === "ok" && !isInjection(c)).length).toBeGreaterThanOrEqual(8);
  expect(all.some((c) => c.id.startsWith("sensitive") && c.expect.status === "ok")).toBe(true);
  expect(all.some((c) => Object.values(c.expect.dues ?? {}).includes(null))).toBe(true);
  expect(new Set(all.map((c) => c.id)).size).toBe(all.length);
});

test("every golden answer passes checkCase", () => {
  for (const c of all) expect(checkCase(c, answers[c.id]), c.id).toEqual([]);
});

test("checkCase catches an invented attendee, a computed far date, a missed self-commitment and a refused HR meeting", () => {
  const byId = (id: string) => all.find((c) => c.id === id)!;
  const s = answers["sample-product-sync"] as { attendees: unknown[]; actionItems: { owner: string | null }[] };
  expect(checkCase(byId("sample-product-sync"), { ...s, attendees: [...s.attendees, { name: "Olivia Grant", role: "CEO" }] }).join(" ")).toMatch(/attendee/);
  const f = answers["far-future-date"] as { actionItems: { dueDate: string | null }[] };
  expect(checkCase(byId("far-future-date"), { ...f, actionItems: f.actionItems.map((i, k) => (k === 0 ? { ...i, dueDate: "2035-12-31" } : i)) }).join(" ")).toMatch(/5 years|cold-storage/);
  const c = answers["commitments-and-relative-dates"] as { actionItems: { owner: string | null }[] };
  expect(checkCase(byId("commitments-and-relative-dates"), { ...c, actionItems: c.actionItems.map((i) => ({ ...i, owner: null })) }).join(" ")).toMatch(/owned by Joel/);
  expect(checkCase(byId("sensitive-hr-meeting"), { status: "refused", message: "This is confidential." })[0]).toMatch(/status/);
});
