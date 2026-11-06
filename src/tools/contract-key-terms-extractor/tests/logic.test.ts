import { describe, expect, test } from "vitest";
import { PDF_MESSAGE, sniff } from "../src/logic/docFile";
import { verifyClauseRef } from "../src/logic/clauses";
import { amountsIn, datesIn, verifyNormalised } from "../src/logic/normalise";
import { isLegalQuestion } from "../src/logic/result";
import { readDocx } from "../src/logic/readDocx";
import { toCsv, toMarkdownChecklist, toPlainText } from "../src/logic/render";
import { DISCLAIMER } from "../src/limits";
import { makeDocx } from "../fixtures/makeDocx";

describe("normalised values must be literally in the quote", () => {
  test("dates in English, French, ISO and numeric forms", () => {
    expect([...datesIn("starts on 1 February 2026 and ends December 31, 2026")]).toEqual(["2026-02-01", "2026-12-31"]);
    expect(datesIn("à compter du 1er septembre 2026").has("2026-09-01")).toBe(true);
    expect(datesIn("signed 2026-03-15").has("2026-03-15")).toBe(true);
    const both = datesIn("on 01/02/2026");
    expect(both.has("2026-02-01") && both.has("2026-01-02")).toBe(true);
    expect(datesIn("on 31 February 2026").size).toBe(0);
  });
  test("amounts with separators and multipliers", () => {
    expect(amountsIn("£4,500 per month")).toContain(4500);
    expect(amountsIn("12.500,00 EUR")).toContain(12500);
    expect(amountsIn("USD 1.2 million")).toContain(1200000);
    expect(amountsIn("€3k")).toContain(3000);
  });
  test("a computed date or an amount not in the quote is cleared", () => {
    expect(verifyNormalised("2026-02-01", "starts on 1 February 2026")).toBe("2026-02-01");
    expect(verifyNormalised("2026-03-03", "30 days after signing")).toBeNull();
    expect(verifyNormalised({ amount: 4500, currency: "GBP" }, "a fee of £4,500 per month")).toEqual({ amount: 4500, currency: "GBP" });
    expect(verifyNormalised({ amount: 54000, currency: "GBP" }, "a fee of £4,500 per month")).toBeNull();
  });
});

describe("clause references", () => {
  const text = "3. Fees and Payment\n3.1 The Client shall pay a fee of £4,500 per month.\n\nThe Client pays within 30 days.";
  test("kept when in the quote, on its line or on the heading line above", () => {
    expect(verifyClauseRef("3.1", "The Client shall pay a fee of £4,500 per month.", text)).toBe("3.1");
    expect(verifyClauseRef("Clause 3.1", "3.1 The Client shall pay a fee of £4,500 per month.", text)).toBe("Clause 3.1");
    expect(verifyClauseRef("3", "3.1 The Client shall pay a fee of £4,500 per month.", text)).toBe("3");
  });
  test("cleared when invented", () => {
    expect(verifyClauseRef("7.2", "The Client shall pay a fee of £4,500 per month.", text)).toBeNull();
    expect(verifyClauseRef("4", "The Client pays within 30 days.", text)).toBeNull();
    expect(verifyClauseRef("  ", "anything", text)).toBeNull();
  });
});

describe("legal questions in the look-for box", () => {
  test("detected", () => {
    expect(isLegalQuestion("Is this non-compete enforceable?")).toBe(true);
    expect(isLegalQuestion("should I sign this?")).toBe(true);
    expect(isLegalQuestion("payment deadlines and notice periods")).toBe(false);
  });
});

describe("files read in the browser", () => {
  test("PDF refused with the copy-and-paste message, .doc refused, .txt read", () => {
    expect(sniff("c.pdf", new Uint8Array([0x25, 0x50, 0x44, 0x46]), { md: false, docx: true })).toEqual({ kind: "pdf", error: PDF_MESSAGE });
    expect(sniff("c.doc", new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]), { md: false, docx: true }).error).toMatch(/\.docx/);
    expect(sniff("c.txt", new TextEncoder().encode("Agreement"), { md: false, docx: true })).toEqual({ kind: "text", error: null });
  });
  test(".docx text extracted with mammoth", async () => {
    const bytes = makeDocx(["LEASE", "1.1 Rent is $2,000 per month."]);
    expect((await readDocx(bytes)).trim()).toBe("LEASE\n\n1.1 Rent is $2,000 per month.");
  });
});

describe("exports start with the disclaimer", () => {
  const terms = [{ category: "payment" as const, label: "Fee", value: '=HYPERLINK("x")', normalised: { amount: 4500, currency: "GBP" }, clauseRef: "3.1", quote: "pay a fee of £4,500\nper month" }];
  test("CSV: BOM, disclaimer, quoted cells, formulas defused", () => {
    const csv = toCsv(terms);
    expect(csv.startsWith(`﻿"${DISCLAIMER}"`)).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain('"4,500 GBP","3.1","pay a fee of £4,500 per month"');
  });
  test("Markdown checklist and text", () => {
    const md = toMarkdownChecklist(terms, ["liability"], []);
    expect(md.split("\n")[0]).toBe(`> ${DISCLAIMER}`);
    expect(md).toContain("- [ ] **Fee**:");
    expect(md).toContain("## Not found in this text\n\n- Liability");
    expect(toPlainText(terms, []).startsWith(DISCLAIMER)).toBe(true);
  });
});
