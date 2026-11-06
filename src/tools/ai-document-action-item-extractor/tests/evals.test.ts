import { expect, test } from "vitest";
import cases from "../evals/cases.json";
import golden from "../evals/golden.json";
import { checkCase, type EvalCase } from "../evals/check";

const all = cases as EvalCase[];
const answers = golden as Record<string, unknown>;
const isInjection = (c: EvalCase) => /ignore (the|previous)/i.test(JSON.stringify(c.input));

test("at least 12 cases: 8+ normal, 2+ refused, 2+ injection attempts, English, French and Arabic", () => {
  expect(all.length).toBeGreaterThanOrEqual(12);
  expect(all.filter((c) => c.expect.status === "refused").length).toBeGreaterThanOrEqual(2);
  expect(all.filter(isInjection).length).toBeGreaterThanOrEqual(2);
  expect(all.filter((c) => c.expect.status !== "refused" && !isInjection(c)).length).toBeGreaterThanOrEqual(8);
  expect(all.some((c) => /[\u0600-\u06FF]/.test(c.input.text)) && all.some((c) => /enverra/.test(c.input.text))).toBe(true);
  expect(new Set(all.map((c) => c.id)).size).toBe(all.length);
});

test("every golden answer passes checkCase", () => {
  for (const c of all) expect(checkCase(c, answers[c.id]), c.id).toEqual([]);
});

test("checkCase catches invented quotes and owners, impossible dates and wrong relative dates", () => {
  const byId = (id: string) => all.find((c) => c.id === id)!;
  const good = answers["meeting-notes-sample"] as { items: Record<string, unknown>[] };
  const one = (patch: Record<string, unknown>) => ({ status: "ok", items: [{ ...good.items[0], ...patch }] });
  expect(checkCase(byId("meeting-notes-sample"), one({ quote: "Marco will rewrite the whole website." })).join(" ")).toMatch(/quote is not in the text/);
  expect(checkCase(byId("meeting-notes-sample"), one({ owner: "Jessica" })).join(" ")).toMatch(/invented/);
  expect(checkCase(byId("meeting-notes-sample"), one({ dueDate: "2026-02-30" })).join(" ")).toMatch(/not a valid date/);
  expect(checkCase(byId("meeting-notes-sample"), one({ dueDate: "2026-11-11" })).join(" ")).toMatch(/resolves to 2026-11-04/);
  expect(checkCase(byId("off-topic-question"), good)[0]).toMatch(/status/);
});

test("v2: the writer's own commitment is required, one sentence split into two items is caught, far dates must be null", () => {
  const byId = (id: string) => all.find((c) => c.id === id)!;
  const email = answers["email-thread"] as { items: { owner: string | null; quote: string }[] };
  expect(checkCase(byId("email-thread"), { status: "ok", items: email.items.filter((i) => i.owner !== "Dana") }).join(" ")).toMatch(/Dana/);
  const split = { status: "ok", items: [email.items[0], { ...email.items[0], task: "Send the final version to Dana" }, ...email.items.slice(1)] };
  expect(checkCase(byId("email-thread"), split).join(" ")).toMatch(/one item per distinct task/);
  const far = answers["far-future-date"] as { items: Record<string, unknown>[] };
  expect(checkCase(byId("far-future-date"), { status: "ok", items: [{ ...far.items[0], dueDate: "2040-12-31" }] }).join(" ")).toMatch(/not a valid date within 5 years|must not contain/);
});
