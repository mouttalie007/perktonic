import { expect, test } from "vitest";
import cases from "../evals/cases.json";
import golden from "../evals/golden.json";
import { checkCase, type EvalCase } from "../evals/check";

const all = cases as EvalCase[];
const answers = golden as Record<string, Record<string, unknown>>;
const isInjection = (c: EvalCase) => /ignore (your|previous|the)/i.test(c.input.text);

test("at least 12 cases: 8+ normal, 2+ refused, 2+ injection attempts, a sensitive document and a no-figure case", () => {
  expect(all.length).toBeGreaterThanOrEqual(12);
  expect(all.filter((c) => c.expect.status === "refused").length).toBeGreaterThanOrEqual(2);
  expect(all.filter(isInjection).length).toBeGreaterThanOrEqual(2);
  expect(all.filter((c) => c.expect.status !== "refused" && !isInjection(c)).length).toBeGreaterThanOrEqual(8);
  expect(all.some((c) => c.id.startsWith("sensitive"))).toBe(true);
  expect(new Set(all.map((c) => c.id)).size).toBe(all.length);
});

test("every golden answer passes checkCase", () => {
  for (const c of all) expect(checkCase(c, answers[c.id]), c.id).toEqual([]);
});

test("checkCase catches invented figures, invented quotes, a refusal of a sensitive document and the wrong language", () => {
  const byId = (id: string) => all.find((c) => c.id === id)!;
  const good = answers["library-annual-review"];
  expect(checkCase(byId("library-annual-review"), { ...good, summary: `${good.summary} Visitor numbers will reach 500,000 next year.` }).join(" ")).toMatch(/500,000/);
  expect(checkCase(byId("library-annual-review"), { ...good, keyPoints: [{ text: "x", quote: "The library was a great success." }, ...(good.keyPoints as unknown[]).slice(1)] }).join(" ")).toMatch(/quote/);
  expect(checkCase(byId("sensitive-incident-report"), { status: "refused", message: "I can't help with that." })[0]).toMatch(/status/);
  const fr = answers["french-document"];
  expect(checkCase(byId("french-document"), { ...fr, summary: "The council approved the pool budget and free school meals for low-income families." }).join(" ")).toMatch(/language/);
  expect(checkCase(byId("no-headings-digest"), { ...answers["no-headings-digest"], sections: [] }).join(" ")).toMatch(/digest/);
});
