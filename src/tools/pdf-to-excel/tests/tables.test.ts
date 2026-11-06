import { describe, expect, test } from "vitest";
import * as F from "../fixtures/pdfs";
import { PROTECTED_PASSWORD, PROTECTED_PDF_BASE64 } from "../fixtures/protectedPdf";
import { sampleAnalysis } from "../fixtures/sampleAnalysis";
import { SAMPLE_PDF_DATA_URL } from "../fixtures/samplePdf";
import { analysePages, parsePageRange } from "../src/logic/pdfTables";
import { analyse, openPdf } from "./pdfjs";

describe("ruled tables (cell borders)", () => {
  test("a ruled invoice table, cell by cell", async () => {
    const a = await analyse(F.ruledInvoicePdf());
    expect(a.tables).toHaveLength(1);
    const t = a.tables[0];
    expect(t.method).toBe("ruled");
    expect(t.rows).toEqual([
      ["Item", "Qty", "Unit price", "Amount"],
      ["Laser paper A4 (box)", "12", "24.50", "294.00"],
      ["Toner cartridge TN-421", "3", "89.90", "269.70"],
      ["Desk organiser", "5", "12.00", "60.00"],
      ["Shipping", "1", "15.00", "15.00"],
    ]);
    expect(t.headerRows).toBe(1);
  });

  test("a merged header: 'Revenue' spans two columns and 'Region' two rows", async () => {
    const t = (await analyse(F.mergedHeaderPdf())).tables[0];
    expect(t.rows).toEqual([
      ["Region", "Revenue", ""],
      ["", "Q1", "Q2"],
      ["North", "1,250", "1,410"],
      ["South", "980", "1,105"],
      ["West", "1,630", "1,702"],
    ]);
    expect(t.merges).toEqual([
      { row: 0, col: 0, rowSpan: 2, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 2 },
    ]);
    expect(t.headerRows).toBe(2);
  });

  test("a table over three pages is one table; the repeated header is dropped on pages 2 and 3", async () => {
    const a = await analyse(F.threePagePdf());
    expect(a.tables).toHaveLength(1);
    const t = a.tables[0];
    expect(t.pages).toEqual([1, 2, 3]);
    expect(t.droppedHeaders).toBe(2);
    expect(t.rows).toHaveLength(1 + 30 + 30 + 4);
    expect(t.rows[0]).toEqual(["Date", "Description", "Reference", "Amount"]);
    expect(t.rows[31]).toEqual(["2026-09-04", "Card payment 31", "REF00031", "224.75"]);
    expect(t.rows.at(-1)).toEqual(["2026-09-09", "Card payment 64", "REF00064", "464.00"]);
    expect(t.rows.filter((r) => r[0] === "Date")).toHaveLength(1);
  });

  test("a page range reads only those pages", async () => {
    expect(parsePageRange("1-3, 5", 6)).toEqual({ ok: true, pages: [1, 2, 3, 5] });
    expect(parsePageRange("", 2)).toEqual({ ok: true, pages: [1, 2] });
    expect(parsePageRange("7", 3)).toMatchObject({ ok: false, error: expect.stringMatching(/3 pages/) });
    expect(parsePageRange("a-b", 3)).toMatchObject({ ok: false });
    const a = await analyse(F.threePagePdf(), "auto", [2]);
    expect(a.pagesRead).toEqual([2]);
    expect(a.tables[0].rows[1][1]).toBe("Card payment 31");
  });
});

describe("tables without rules (text alignment)", () => {
  test("a borderless financial table with right-aligned numbers", async () => {
    const t = (await analyse(F.borderlessFinancialPdf())).tables[0];
    expect(t.method).toBe("aligned");
    expect(t.rows).toEqual([
      ["", "2026", "2025", "Change"],
      ["Revenue", "12.480,5", "11.032,0", "13,1%"],
      ["Cost of sales", "(7.215,3)", "(6.540,8)", "10,3%"],
      ["Gross profit", "5.265,2", "4.491,2", "17,2%"],
      ["Operating expenses", "(3.104,9)", "(2.987,4)", "3,9%"],
      ["Operating profit", "2.160,3", "1.503,8", "43,7%"],
    ]);
    expect(t.headerRows).toBe(1);
  });

  test("two tables on one page stay separate; titles and notes are not table rows", async () => {
    const a = await analyse(F.twoTablesPdf());
    expect(a.tables.map((t) => t.rows)).toEqual([
      [["Office", "2025", "2026"], ["London", "42", "48"], ["Paris", "18", "23"], ["Berlin", "11", "15"]],
      [["Role", "Office", "Openings"], ["Data analyst", "London", "2"], ["Sales lead", "Paris", "1"], ["Engineer", "Berlin", "3"]],
    ]);
  });

  test("the visitor can force one method", async () => {
    expect((await analyse(F.ruledInvoicePdf(), "aligned")).tables[0].method).toBe("aligned");
    expect((await analyse(F.borderlessFinancialPdf(), "ruled")).tables).toEqual([]);
  });
});

describe("special PDFs", () => {
  test("a PDF without a text layer is detected (a scan)", async () => {
    const a = await analyse(F.noTextPdf());
    expect(a.textless).toBe(true);
    expect(a.tables).toEqual([]);
  });

  test("a right-to-left (Arabic) table: columns start on the right, text stays in reading order", async () => {
    const t = (await analyse(F.arabicPdf())).tables[0];
    expect(t.rtl).toBe(true);
    expect(t.rows).toEqual([
      ["المنتج", "الكمية", "السعر"],
      ["قهوة", "4", "120"],
      ["شاي", "10", "35"],
      ["سكر", "6", "18"],
    ]);
  });

  test("a rotated page is read in its display orientation", async () => {
    const t = (await analyse(F.rotatedPdf())).tables[0];
    expect(t.rows).toEqual([
      ["Product", "Units", "Revenue"],
      ["Basic plan", "1,200", "14,400"],
      ["Pro plan", "340", "16,660"],
      ["Team plan", "85", "12,665"],
    ]);
  });

  test("a password-protected PDF needs the password, then reads normally", async () => {
    const bytes = Uint8Array.from(Buffer.from(PROTECTED_PDF_BASE64, "base64"));
    await expect(openPdf(bytes)).rejects.toMatchObject({ name: "PasswordException", code: 1 });
    await expect(openPdf(bytes, "wrong")).rejects.toMatchObject({ name: "PasswordException", code: 2 });
    const doc = await openPdf(bytes, PROTECTED_PASSWORD);
    expect(doc.numPages).toBe(1);
  });

  test("the built-in sample PDF and its saved analysis are current", async () => {
    const bytes = F.samplePdf();
    expect(SAMPLE_PDF_DATA_URL).toBe(`data:application/pdf;base64,${Buffer.from(bytes).toString("base64")}`);
    expect(JSON.parse(JSON.stringify(await analyse(bytes)))).toEqual(sampleAnalysis);
    expect(sampleAnalysis.tables.map((t) => t.method)).toEqual(["ruled", "aligned"]);
  });

  test("pages are analysed deterministically from their runs and rules (no pdf.js needed)", () => {
    const a = analysePages([{ page: 1, width: 595, height: 842, runs: [], rules: [] }], "auto");
    expect(a).toEqual({ tables: [], pagesRead: [1], textless: true });
  });
});
