import { strFromU8, unzipSync } from "fflate";
import { describe, expect, test } from "vitest";
import * as F from "../fixtures/pdfs";
import { sampleAnalysis } from "../fixtures/sampleAnalysis";
import { combinedCsv, encode, field, tableCsv, type CsvOptions } from "../src/logic/csv";
import { buildOutput } from "../src/logic/files";
import type { Table } from "../src/logic/pdfTables";
import { analyse } from "./pdfjs";

const o: CsvOptions = { delimiter: ",", eol: "\r\n", protect: true };
const table = (rows: string[][], pages = [2]): Table => ({ pages, method: "ruled", rows, merges: [], headerRows: 1, rtl: false, edges: [], top: 0, bottom: 0, droppedHeaders: 0 });

describe("CSV text", () => {
  test("RFC 4180 quoting: delimiter, quotes, line breaks and edge spaces", () => {
    expect(field("plain", o)).toBe("plain");
    expect(field("Gloves, box of 100", o)).toBe('"Gloves, box of 100"');
    expect(field('12" pipe', o)).toBe('"12"" pipe"');
    expect(field("two\nlines", o)).toBe('"two\nlines"');
    expect(field(" padded", o)).toBe('" padded"');
    expect(field("a;b", { ...o, delimiter: ";" })).toBe('"a;b"');
    expect(field("a,b", { ...o, delimiter: ";" })).toBe("a,b");
  });

  test("the four delimiters and both line endings", () => {
    const t = table([["SKU", "Item"], ["00417", "Gloves; nitrile"]]);
    expect(tableCsv(t, o)).toBe("SKU,Item\r\n00417,Gloves; nitrile\r\n");
    expect(tableCsv(t, { ...o, delimiter: ";", eol: "\n" })).toBe('SKU;Item\n00417;"Gloves; nitrile"\n');
    expect(tableCsv(t, { ...o, delimiter: "\t" })).toBe("SKU\tItem\r\n00417\tGloves; nitrile\r\n");
    expect(tableCsv(t, { ...o, delimiter: "|" })).toBe("SKU|Item\r\n00417|Gloves; nitrile\r\n");
  });

  test("formula protection: on by default, plain numbers untouched, can be turned off", () => {
    const t = table([["=SUM(A1:A9)", "+44 20 7946", "-12.50", "@cmd", "-"]]);
    expect(tableCsv(t, o)).toBe("'=SUM(A1:A9),'+44 20 7946,-12.50,'@cmd,'-\r\n");
    expect(tableCsv(t, { ...o, protect: false })).toBe("=SUM(A1:A9),+44 20 7946,-12.50,@cmd,-\r\n");
  });

  test("a PDF table read cell by cell becomes the expected CSV", async () => {
    const t = (await analyse(F.ruledInvoicePdf())).tables[0];
    expect(tableCsv(t, { ...o, eol: "\n" })).toBe("Item,Qty,Unit price,Amount\nLaser paper A4 (box),12,24.50,294.00\nToner cartridge TN-421,3,89.90,269.70\nDesk organiser,5,12.00,60.00\nShipping,1,15.00,15.00\n");
  });
});

describe("encodings: é and € in every encoding", () => {
  const text = "é€";
  test("UTF-8, with and without BOM", () => {
    expect([...encode(text, "utf-8").bytes]).toEqual([0xc3, 0xa9, 0xe2, 0x82, 0xac]);
    expect([...encode(text, "utf-8-bom").bytes]).toEqual([0xef, 0xbb, 0xbf, 0xc3, 0xa9, 0xe2, 0x82, 0xac]);
  });
  test("Windows-1252 has both; ISO-8859-1 has no euro sign (replaced and counted)", () => {
    expect(encode(text, "windows-1252")).toEqual({ bytes: Uint8Array.from([0xe9, 0x80]), replaced: 0 });
    expect(encode(text, "iso-8859-1")).toEqual({ bytes: Uint8Array.from([0xe9, 0x3f]), replaced: 1 });
    expect(encode("قهوة 😀", "windows-1252").replaced).toBe(5);
  });
  test("UTF-16 LE with BOM", () => {
    expect([...encode(text, "utf-16le-bom").bytes]).toEqual([0xff, 0xfe, 0xe9, 0x00, 0xac, 0x20]);
  });
});

describe("files", () => {
  test("several tables → a ZIP with predictable names; one table → one CSV; combined → a 'table' column", () => {
    const sel = sampleAnalysis.tables.map((table, i) => ({ table, index: i + 1 }));
    const zip = buildOutput(sel, { ...o, encoding: "utf-8", combined: false, base: "Invoice 118.pdf" });
    expect(zip.name).toBe("Invoice-118-tables.zip");
    const files = unzipSync(zip.bytes);
    expect(Object.keys(files)).toEqual(["table-1-p1.csv", "table-2-p1.csv"]);
    expect(strFromU8(files["table-2-p1.csv"])).toBe("Subtotal,602.50,USD\r\nSales tax 8%,48.20,USD\r\nTotal due,650.70,USD\r\n");
    const one = buildOutput(sel.slice(1), { ...o, encoding: "utf-8-bom", combined: false, base: "x.pdf" });
    expect(one.name).toBe("x-table-2-p1.csv");
    expect([...one.bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(combinedCsv(sel, { ...o, eol: "\n" }).split("\n").slice(0, 3)).toEqual(["table,column 1,column 2,column 3,column 4,column 5", "1,SKU,Description,Qty,Unit price,Amount", '1,00417,"Nitrile gloves, box of 100",20,8.90,178.00']);
    expect(combinedCsv(sel, o)).toContain("2,Total due,650.70,USD,,\r\n");
  });

  test("characters the encoding cannot hold are counted across files", () => {
    const sel = [{ table: table([["Price", "€5"]]), index: 1 }, { table: table([["Café", "€7"]], [3]), index: 2 }];
    expect(buildOutput(sel, { ...o, encoding: "iso-8859-1", combined: false, base: "a" }).replaced).toBe(2);
  });
});
