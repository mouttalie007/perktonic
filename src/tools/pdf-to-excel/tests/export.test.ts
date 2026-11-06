import { strFromU8, unzipSync } from "fflate";
import { describe, expect, test } from "vitest";
import { sampleAnalysis } from "../fixtures/sampleAnalysis";
import { checkFile } from "../src/logic/file";
import { guessStyle, looksLikeFormula, toValue, type Table } from "../src/logic/pdfTables";
import { buildSheets, previewRows, tableCells, toTsv } from "../src/logic/workbook";
import { colName, sheetNames, writeXlsx } from "../src/logic/xlsx";

const table = (rows: string[][], extra: Partial<Table> = {}): Table => ({ pages: [2], method: "ruled", rows, merges: [], headerRows: 1, rtl: false, edges: [], top: 0, bottom: 0, droppedHeaders: 0, ...extra });

describe("cell values", () => {
  test("numbers become numbers; identifiers, phone numbers, '+' prefixes and dates stay text", () => {
    const n = (s: string, st: "dot" | "comma" = "dot") => toValue(s, st);
    expect(n("1,234.56")).toEqual({ kind: "number", value: 1234.56, percent: false });
    expect(n("1.234,56", "comma")).toEqual({ kind: "number", value: 1234.56, percent: false });
    expect(n("(7.215,3)", "comma")).toMatchObject({ value: -7215.3 });
    expect(n("$ 89.90")).toMatchObject({ value: 89.9 });
    expect(n("13,1%", "comma")).toEqual({ kind: "number", value: 0.131, percent: true });
    expect(n("0.5")).toMatchObject({ kind: "number", value: 0.5 });
    for (const s of ["00417", "+44 20 7946 0958", "555-0134", "(555) 123-4567", "2026-09-04", "14/10/2026", "INV-2026"]) expect(n(s).kind, s).toBe("text");
    expect(guessStyle(["12.480,5", "11.032,0", "3,9%"])).toBe("comma");
    expect(guessStyle(["1,234.50", "89.90"])).toBe("dot");
  });

  test("formula-looking text is detected, plain negative numbers are not", () => {
    expect(looksLikeFormula('=HYPERLINK("x")')).toBe(true);
    expect(looksLikeFormula("@SUM(A1)")).toBe(true);
    expect(looksLikeFormula("-12.5")).toBe(false);
    expect(looksLikeFormula("Total")).toBe(false);
  });
});

describe(".xlsx", () => {
  const files = (bytes: Uint8Array) => Object.fromEntries(Object.entries(unzipSync(bytes)).map(([k, v]) => [k, strFromU8(v)]));

  test("one sheet per table, named 'Table 1 (p2)'; numbers numeric, ids text, header bold and frozen, formulas never written", () => {
    const t = table([["SKU", "Item", "Amount"], ["00417", '=HYPERLINK("http://x")', "1,234.50"], ["00982", "Paper", "86.00"]]);
    const x = files(writeXlsx(buildSheets([{ table: t, index: 1, header: true }], "auto", false)));
    expect(x["xl/workbook.xml"]).toContain('<sheet name="Table 1 (p2)" sheetId="1" r:id="rId1"/>');
    const sheet = x["xl/worksheets/sheet1.xml"];
    expect(sheet).toContain('<c r="A2" t="inlineStr"><is><t xml:space="preserve">00417</t></is></c>');
    expect(sheet).toContain('<c r="C2"><v>1234.5</v></c>');
    expect(sheet).toContain('<c r="B2" t="inlineStr" s="2"><is><t xml:space="preserve">=HYPERLINK(&quot;http://x&quot;)</t></is></c>');
    expect(sheet).not.toContain("<f>");
    expect(sheet).toContain('<c r="A1" t="inlineStr" s="1">');
    expect(sheet).toContain('state="frozen"');
  });

  test("merged header cells, right-to-left sheets and the one-sheet layout", () => {
    const merged = table([["Region", "Revenue", ""], ["", "Q1", "Q2"], ["North", "1,250", "1,410"]], { merges: [{ row: 0, col: 0, rowSpan: 2, colSpan: 1 }, { row: 0, col: 1, rowSpan: 1, colSpan: 2 }], headerRows: 2 });
    const rtl = table([["المنتج", "السعر"], ["قهوة", "120"]], { rtl: true, pages: [3] });
    const x = files(writeXlsx(buildSheets([{ table: merged, index: 1, header: true }, { table: rtl, index: 2, header: true }], "auto", false)));
    expect(x["xl/worksheets/sheet1.xml"]).toContain('<mergeCells count="2"><mergeCell ref="A1:A2"/><mergeCell ref="B1:C1"/></mergeCells>');
    expect(x["xl/worksheets/sheet2.xml"]).toContain('rightToLeft="1"');
    expect(previewRows(merged)[0]).toEqual(["Region", "Revenue", "Revenue"]);
    expect(previewRows(merged)[1][0]).toBe("Region");
    const one = files(writeXlsx(buildSheets([{ table: merged, index: 1, header: true }, { table: rtl, index: 2, header: false }], "auto", true)));
    expect(Object.keys(one).filter((k) => k.startsWith("xl/worksheets/"))).toHaveLength(1);
    expect(one["xl/worksheets/sheet1.xml"]).toContain('<mergeCell ref="A2:A3"/>');
    expect(one["xl/worksheets/sheet1.xml"]).toContain("Table 2 (p3)");
  });

  test("sheet names: at most 31 characters, no []:*?/\\, unique", () => {
    expect(sheetNames(["Q1/Q2 [draft]: costs*?", "a".repeat(40), "a".repeat(40), ""])).toEqual(["Q1 Q2 draft costs", "a".repeat(31), `${"a".repeat(27)} (2)`, "Sheet"]);
    expect(colName(0)).toBe("A");
    expect(colName(27)).toBe("AB");
  });

  test("copy gives tab-separated cells; the sample's header and number cells are typed", () => {
    expect(toTsv(sampleAnalysis.tables[1])).toBe("Subtotal\t602.50\tUSD\nSales tax 8%\t48.20\tUSD\nTotal due\t650.70\tUSD");
    const cells = tableCells({ table: sampleAnalysis.tables[0], index: 1, header: true }, "auto");
    expect(cells[1]).toEqual([{ t: "s", v: "00417", protect: false }, { t: "s", v: "Nitrile gloves, box of 100", protect: false }, { t: "n", v: 20, pct: false }, { t: "n", v: 8.9, pct: false }, { t: "n", v: 178, pct: false }]);
  });
});

describe("files", () => {
  test("magic bytes, size and images are checked before reading", () => {
    const pdf = new TextEncoder().encode("%PDF-1.7\n");
    expect(checkFile("a.pdf", 100, pdf)).toBeNull();
    expect(checkFile("a.pdf", 100, new TextEncoder().encode("hello"))).toMatch(/not a PDF/);
    expect(checkFile("scan.png", 100, new Uint8Array([0x89, 0x50]))).toMatch(/Scanned Table tool/);
    expect(checkFile("a.pdf", 21 * 1024 * 1024, pdf)).toMatch(/20 MB/);
    expect(checkFile("a.pdf", 0, pdf)).toMatch(/empty/);
  });
});
