import { strFromU8, unzipSync } from "fflate";
import { describe, expect, test } from "vitest";
import { samplePage } from "../fixtures/sampleResult";
import { gridCsv, gridTsv, gridXlsx, toNumber, westernDigits } from "../src/logic/export";
import { checkFile, sniff } from "../src/logic/file";
import { addColumn, addRow, mergeColumns, mergeRows, removeColumn, removeRow, setText, splitColumn, splitRow, texts } from "../src/logic/grid";
import type { Cell, Grid } from "../src/logic/table";

const cell = (text: string, confidence: number | null = 90): Cell => ({ text, confidence, box: { x0: 0, y0: 0, x1: 10, y1: 10 }, span: 1 });
const g: Grid = { rtl: false, rows: [[cell("Item"), cell("Qty")], [cell("Coffee 120"), cell("")], [cell("Tea"), cell("4", 40)]] };

describe("editing the grid", () => {
  test("edit a cell: the visitor's value is no longer flagged", () => {
    const e = setText(g, 2, 1, "4");
    expect(e.rows[2][1]).toMatchObject({ text: "4", confidence: null });
    expect(g.rows[2][1].confidence).toBe(40);
  });
  test("add and remove rows and columns", () => {
    expect(texts(addRow(g, 0))).toEqual([["Item", "Qty"], ["", ""], ["Coffee 120", ""], ["Tea", "4"]]);
    expect(texts(removeRow(g, 1))).toEqual([["Item", "Qty"], ["Tea", "4"]]);
    expect(texts(addColumn(g, 0))[0]).toEqual(["Item", "", "Qty"]);
    expect(texts(removeColumn(g, 0))).toEqual([["Qty"], [""], ["4"]]);
  });
  test("split a column at the last space (two columns read as one), merge them back", () => {
    const s = splitColumn(g, 0);
    expect(texts(s)).toEqual([["Item", "", "Qty"], ["Coffee", "120", ""], ["Tea", "", "4"]]);
    expect(texts(mergeColumns(s, 0))[1]).toEqual(["Coffee 120", ""]);
  });
  test("merge two rows (a wrapped line), split them again", () => {
    const two: Grid = { rtl: false, rows: [[cell("Coffee"), cell("1")], [cell("Tea"), cell("4", 40)]] };
    const m = mergeRows(two, 0);
    expect(texts(m)).toEqual([["Coffee\nTea", "1\n4"]]);
    expect(m.rows[0][1].confidence).toBe(40);
    expect(texts(splitRow(m, 0))).toEqual(texts(two));
    expect(texts(mergeRows(g, 1))[1]).toEqual(["Coffee 120\nTea", "4"]);
    expect(splitRow(g, 0)).toBe(g);
  });
});

describe("export", () => {
  test("numbers: western and Arabic-Indic digits; identifiers with leading zeros stay text", () => {
    expect(westernDigits("١٢٣٫٥")).toBe("123.5");
    expect(toNumber("١٢٠")).toBe(120);
    expect(toNumber("1,234.50")).toBe(1234.5);
    expect(toNumber("1.234,50")).toBe(1234.5);
    expect(toNumber("00417")).toBeNull();
    expect(toNumber("A-03")).toBeNull();
    expect(toNumber("1O5")).toBeNull();
  });
  test(".xlsx: a spanning title is merged, numbers are numbers, right-to-left sheets are flagged", () => {
    const files = unzipSync(gridXlsx([{ grid: samplePage.grid, page: 1 }, { grid: { ...g, rtl: true }, page: 2 }], true));
    const s1 = strFromU8(files["xl/worksheets/sheet1.xml"]);
    expect(s1).toContain('<mergeCell ref="A1:E1"/>');
    expect(s1).toContain('<c r="E3"><v>8.9</v></c>');
    expect(s1).toContain('<c r="A3" t="inlineStr"><is><t xml:space="preserve">00417</t></is></c>');
    expect(strFromU8(files["xl/worksheets/sheet2.xml"])).toContain('rightToLeft="1"');
    expect(strFromU8(files["xl/workbook.xml"])).toContain('<sheet name="Page 2"');
  });
  test(".csv: UTF-8 with BOM, quoted, formulas defused; copy gives tab-separated text", () => {
    const bytes = gridCsv([{ grid: setText(g, 0, 0, "=1+1"), page: 1 }]);
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(strFromU8(bytes.slice(3))).toBe("'=1+1,Qty\r\nCoffee 120,\r\nTea,4\r\n");
    expect(gridTsv(g)).toBe("Item\tQty\nCoffee 120\t\nTea\t4");
  });
});

describe("files", () => {
  test("magic bytes decide the type; size and unknown types are refused", () => {
    expect(sniff(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpeg");
    expect(sniff(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("png");
    expect(sniff(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("webp");
    expect(sniff(new TextEncoder().encode("%PDF-1.5"))).toBe("pdf");
    expect(checkFile(100, new TextEncoder().encode("GIF89a"))).toMatchObject({ ok: false, error: expect.stringMatching(/not supported/) });
    expect(checkFile(11 * 1024 * 1024, Uint8Array.from([0xff, 0xd8, 0xff]))).toMatchObject({ ok: false, error: expect.stringMatching(/10 MB/) });
  });
});
