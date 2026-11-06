import { describe, expect, test } from "vitest";
import { decodeText, limitText, PDF_MESSAGE, sniff } from "../src/logic/docFile";
import { checkFigures, figuresIn, sourceDigits } from "../src/logic/figures";
import { readDocx } from "../src/logic/readDocx";
import { buildResult } from "../src/logic/result";
import { reduction, wordCount } from "../src/logic/stats";
import { makeDocx } from "../fixtures/makeDocx";

const SOURCE = "Sales grew by 12,5 % to 1 250 000 dollars in fiscal 2026. Staff: 3400. The p99 was 720 ms; price 2.50 EUR.";

describe("figures must come from the source text", () => {
  test("separators, decimal commas, currencies and percentages are compared by their digits", () => {
    const d = sourceDigits(SOURCE);
    expect(checkFigures("Sales rose 12.5% to $1,250,000 in 2026 with 3,400 staff; price €2.5.", d).every((f) => f.found)).toBe(true);
  });
  test("invented figures are marked, never removed; 500,000 is not mistaken for 5", () => {
    const d = sourceDigits("There are 5 branches and 350,000 visitors.");
    expect(checkFigures("About 500,000 visitors and 18 new stores.", d)).toEqual([
      { text: "500,000", found: false },
      { text: "18", found: false },
    ]);
  });
  test("a figure glued to a letter (p99, v3.2) is not merged with the next number", () => {
    expect(figuresIn("p99 720 ms")).toEqual(["99", "720"]);
  });
});

describe("result: quotes, digest and lengths are computed by us", () => {
  const text = "Alpha project report. The team delivered 3 releases in 2026 and cut costs by 8%. Next year the budget is 40,000 euros. ".repeat(3);
  test("unverified quotes are labelled, figures counted, digest dropped when not asked, lengths computed", () => {
    const r = buildResult(
      { status: "ok", summary: "The team shipped 3 releases and cut costs by 9%.", keyPoints: [{ text: "3 releases in 2026.", quote: "The team delivered 3 releases in 2026" }, { text: "Costs fell.", quote: "Costs fell sharply." }], sections: [{ heading: "Results", summary: "x" }] },
      { text, sections: false },
      false,
    );
    if (r.status !== "ok") throw new Error("expected ok");
    expect(r.keyPoints.map((k) => k.verified)).toEqual([true, false]);
    expect(r.unverifiedQuotes).toBe(1);
    expect(r.summaryFigures).toEqual([{ text: "3", found: true }, { text: "9%", found: false }]);
    expect(r.unverifiedFigures).toBe(1);
    expect(r.sections).toEqual([]);
    expect(r.stats).toEqual({ originalWords: wordCount(text), originalChars: text.length, summaryWords: 10, reductionPercent: reduction(wordCount(text), 10) });
  });
  test("word counts and reduction", () => {
    expect(wordCount("  one two\nthree ")).toBe(3);
    expect(reduction(1000, 150)).toBe(85);
  });
});

describe("files read in the browser", () => {
  test("PDFs are refused with the copy-and-paste message, by magic bytes even when renamed", () => {
    expect(sniff("report.pdf", new Uint8Array([0x25, 0x50, 0x44, 0x46]), { md: true, docx: true })).toEqual({ kind: "pdf", error: PDF_MESSAGE });
    expect(sniff("report.txt", new Uint8Array([0x25, 0x50, 0x44, 0x46]), { md: true, docx: true }).kind).toBe("pdf");
    expect(sniff("old.doc", new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]), { md: true, docx: true }).error).toMatch(/\.docx/);
    expect(sniff("notes.md", new TextEncoder().encode("# x"), { md: true, docx: true })).toEqual({ kind: "text", error: null });
  });
  test(".docx text is extracted with mammoth", async () => {
    const bytes = makeDocx(["Quarterly report", "Revenue grew 4%."]);
    expect(sniff("q.docx", bytes, { md: true, docx: true })).toEqual({ kind: "docx", error: null });
    expect((await readDocx(bytes)).trim()).toBe("Quarterly report\n\nRevenue grew 4%.");
  });
  test("text is decoded and the 20,000-character limit is announced, never silently cut", () => {
    expect(decodeText(new TextEncoder().encode("\uFEFFHello"))).toEqual({ ok: true, text: "Hello" });
    expect(limitText("x".repeat(20001), 20000)).toMatchObject({ ok: false, error: expect.stringMatching(/does not split long documents/) });
    expect(limitText("  \n ", 20000).ok).toBe(false);
  });
});
