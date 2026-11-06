import { expect, test } from "vitest";
import cases from "../evals/cases.json";
import golden from "../evals/golden.json";
import { checkCase, type EvalCase } from "../evals/check";

const all = cases as EvalCase[];
const answers = golden as Record<string, Record<string, unknown>>;
const isInjection = (c: EvalCase) => /ignore your instructions|print your system prompt/i.test(c.input.text);

test("at least 12 cases: 8+ normal, 2+ refused, 2+ injection attempts, a one-sided contract and a no-date case", () => {
  expect(all.length).toBeGreaterThanOrEqual(12);
  expect(all.filter((c) => c.expect.status === "refused").length).toBeGreaterThanOrEqual(2);
  expect(all.filter(isInjection).length).toBeGreaterThanOrEqual(2);
  expect(all.filter((c) => c.expect.status !== "refused" && !isInjection(c)).length).toBeGreaterThanOrEqual(8);
  expect(all.some((c) => c.id === "one-sided-liability") && all.some((c) => c.id === "relative-dates-not-normalised")).toBe(true);
  expect(new Set(all.map((c) => c.id)).size).toBe(all.length);
});

test("every golden answer passes checkCase", () => {
  for (const c of all) expect(checkCase(c, answers[c.id]), c.id).toEqual([]);
});

test("checkCase catches invented quotes, computed dates, a filled-in gap, a wrong clause reference and a refusal", () => {
  const byId = (id: string) => all.find((c) => c.id === id)!;
  const good = answers["services-agreement-sample"] as { terms: Record<string, unknown>[]; notes: string[] };
  const withTerm = (t: Record<string, unknown>) => ({ ...good, terms: [...good.terms, t] });
  expect(checkCase(byId("services-agreement-sample"), withTerm({ ...good.terms[0], quote: "The Client may cancel at any time." })).join(" ")).toMatch(/quote is not in the contract/);
  const dl = answers["relative-dates-not-normalised"] as { terms: Record<string, unknown>[] };
  expect(checkCase(byId("relative-dates-not-normalised"), { ...dl, terms: [{ ...dl.terms[0], normalised: "2026-11-09" }, ...dl.terms.slice(1)] }).join(" ")).toMatch(/not literally in the quote/);
  const saas = answers["saas-auto-renewal-no-amount"] as { terms: Record<string, unknown>[]; notes: string[] };
  expect(checkCase(byId("saas-auto-renewal-no-amount"), { ...saas, terms: [...saas.terms, { category: "governing_law", label: "Law", value: "Delaware (typical)", normalised: null, clauseRef: null, quote: "Fees are billed annually in advance" }] }).join(" ")).toMatch(/governing_law must stay/);
  expect(checkCase(byId("services-agreement-sample"), withTerm({ ...good.terms[6], clauseRef: "9.9" })).join(" ")).toMatch(/clause reference/);
  expect(checkCase(byId("one-sided-liability"), { status: "refused", message: "I can't help with this contract." })[0]).toMatch(/status/);
});
