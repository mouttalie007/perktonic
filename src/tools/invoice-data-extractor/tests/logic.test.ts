import { strFromU8, unzipSync } from "fflate";
import { describe, expect, test } from "vitest";
import { sampleAnswer } from "../fixtures/sampleAnswer";
import { sampleInput } from "../fixtures/sampleInput";
import { sampleResult } from "../fixtures/sampleResult";
import { detectStyle, parseAmount } from "../src/logic/amounts";
import { toCsv, toJson, toXlsx } from "../src/logic/export";
import { maskAccounts } from "../src/logic/mask";
import { linesFromPdfItems, textFromWords } from "../src/logic/readText";
import { arithmetic, buildInvoice } from "../src/logic/result";

describe("amounts are parsed by our code", () => {
  test("both number styles, currency signs and codes, negatives, Arabic-Indic digits", () => {
    expect(parseAmount("1,234.56", "dot")).toEqual({ number: 1234.56, ambiguous: false });
    expect(parseAmount("1.234,56 €", "comma")).toEqual({ number: 1234.56, ambiguous: false });
    expect(parseAmount("£45.00", null).number).toBe(45);
    expect(parseAmount("(12.00)", "dot").number).toBe(-12);
    expect(parseAmount("12.00-", "dot").number).toBe(-12);
    expect(parseAmount("-1.50", "dot").number).toBe(-1.5);
    expect(parseAmount("٢٤١٫٥٠", null).number).toBe(241.5);
    expect(parseAmount("1.2 kg", "dot").number).toBe(1.2);
    expect(parseAmount("4,200", "dot").number).toBe(4200);
    expect(parseAmount("12.00EUR", "dot").number).toBe(12);
  });
  test("a misread letter makes the amount unreadable; '1,234' is ambiguous when the style is unknown", () => {
    expect(parseAmount("3.5O", "dot").number).toBeNull();
    expect(parseAmount("1,234", null)).toEqual({ number: 1234, ambiguous: true });
    expect(parseAmount("1.234", "comma")).toEqual({ number: 1234, ambiguous: false });
    expect(parseAmount("1.234", "dot")).toEqual({ number: 1.234, ambiguous: false });
    expect(detectStyle("Total 1.043,50 €\nTVA 208,70 €")).toBe("comma");
    expect(detectStyle("Subtotal 602.50\nTax 48.20")).toBe("dot");
    expect(detectStyle("Total 15")).toBeNull();
  });
});

describe("server rules", () => {
  test("the saved sample is fully verified and adds up", () => {
    if (sampleResult.status !== "ok") throw new Error("expected ok");
    expect(sampleResult.total).toMatchObject({ value: "650.70", number: 650.7, status: "verified" });
    expect(sampleResult.checks.every((c) => c.status === "pass")).toBe(true);
    expect(sampleResult.checks).toHaveLength(6);
  });

  test("a quote not in the text, a computed amount and a computed date are flagged, never kept as verified", () => {
    const inv = buildInvoice(
      {
        ...sampleAnswer,
        vendor: { value: "Harbor Office Supply LLC", quote: "Harbor Office Supply Inc." },
        subtotal: { value: "602.5", quote: "Subtotal                                                602.50" },
        dueDate: { value: "2026-11-28", quote: "Due date: November 27, 2026" },
      },
      sampleInput,
    );
    expect(inv.vendor).toMatchObject({ status: "check", reason: expect.stringMatching(/not found/) });
    expect(inv.subtotal.status).toBe("verified");
    expect(buildInvoice({ ...sampleAnswer, subtotal: { value: "602.5O", quote: "Subtotal                                                602.50" } }, sampleInput).subtotal.status).toBe("check");
    expect(inv.dueDate).toMatchObject({ status: "check", reason: expect.stringMatching(/date is not written/) });
    expect(buildInvoice({ ...sampleAnswer, total: { value: "0.00", quote: "Total due (USD)                                         650.70" } }, sampleInput).total.status).toBe("check");
  });

  test("currency: a code or a one-currency symbol must be printed; a bare $ does not prove USD", () => {
    const text = "Shop\nTotal $12.00\nTotal 12,00 €";
    const src = { text, source: "pdf" as const };
    const base = { ...sampleAnswer, lineItems: [], taxes: [], subtotal: { value: null, quote: null }, total: { value: null, quote: null } };
    expect(buildInvoice({ ...base, currency: { value: "USD", quote: "Total $12.00" } }, src).currency.status).toBe("check");
    expect(buildInvoice({ ...base, currency: { value: "EUR", quote: "Total 12,00 €" } }, src).currency.status).toBe("verified");
    expect(buildInvoice({ ...base, currency: { value: null, quote: null } }, src).currency.status).toBe("missing");
  });

  test("OCR text: the lowest word confidence of a value is reported and a low one needs checking", () => {
    const text = "CAFE\nMuffin 3.5O\nTOTAL 9.70";
    const src = { text, source: "ocr" as const, words: [{ text: "CAFE", confidence: 95 }, { text: "Muffin", confidence: 93 }, { text: "3.5O", confidence: 41 }, { text: "TOTAL", confidence: 90 }, { text: "9.70", confidence: 62 }] };
    const inv = buildInvoice({ ...sampleAnswer, lineItems: [{ description: "Muffin", quantity: null, unitPrice: null, amount: "3.5O", quote: "Muffin 3.5O" }], taxes: [], subtotal: { value: null, quote: null }, total: { value: "9.70", quote: "TOTAL 9.70" } }, src);
    expect(inv.lineItems[0].description).toMatchObject({ status: "verified", ocr: 93 });
    expect(inv.lineItems[0].amount).toMatchObject({ status: "check", number: null });
    expect(inv.total).toMatchObject({ status: "check", ocr: 62 });
  });

  test("arithmetic: each line, lines against subtotal, subtotal plus taxes against total, with differences", () => {
    const amt = (n: number | null) => ({ value: n === null ? null : String(n), quote: "x", status: "verified" as const, number: n });
    const line = (q: number, u: number, a: number) => ({ description: { value: "x", quote: "x", status: "verified" as const }, quantity: amt(q), unitPrice: amt(u), amount: amt(a), quote: "x" });
    const checks = arithmetic([line(2, 3.5, 7), line(3, 1.1, 3.4)], amt(10.4), [{ name: "VAT", rate: "20%", amount: amt(2.08), quote: "x" }], amt(12.58));
    expect(checks.map((c) => [c.id, c.status, c.difference])).toEqual([
      ["line", "pass", 0],
      ["line", "fail", 0.1],
      ["lines_vs_subtotal", "pass", 0],
      ["subtotal_plus_taxes_vs_total", "fail", 0.1],
    ]);
    expect(arithmetic([], amt(null), [], amt(5)).map((c) => c.status)).toEqual(["skipped", "skipped"]);
  });
});

describe("text read in the browser", () => {
  test("PDF text items become lines; OCR words become lines (right to left for Arabic)", () => {
    const items = [
      { str: "Total", transform: [10, 0, 0, 10, 50, 100], width: 25 },
      { str: "650.70", transform: [10, 0, 0, 10, 400, 100], width: 30 },
      { str: "Invoice", transform: [12, 0, 0, 12, 50, 700], width: 40 },
      { str: "HOS-1", transform: [12, 0, 0, 12, 93, 700], width: 30 },
    ];
    expect(linesFromPdfItems(items)).toBe("Invoice HOS-1\nTotal    650.70");
    const w = (text: string, x0: number, y0: number) => ({ text, confidence: 90, bbox: { x0, y0, x1: x0 + text.length * 9, y1: y0 + 16 } });
    expect(textFromWords([w("TOTAL", 10, 50), w("9.70", 200, 52), w("CAFE", 10, 10)])).toBe("CAFE\nTOTAL    9.70");
    expect(textFromWords([w("قهوة", 300, 10), w("عربية", 240, 10)])).toBe("قهوة عربية");
  });

  test("hide account numbers: IBANs and long digit runs keep only their last 4 digits", () => {
    const m = maskAccounts("IBAN: DE89 3704 0044 0532 0130 00\nCard 4410 2938 1177 0045\nTotal 1,234.56\nInvoice 2026-118");
    expect(m.text).toBe("IBAN: DE89 XXXX XXXX XXXX XX30 00\nCard XXXX XXXX XXXX 0045\nTotal 1,234.56\nInvoice 2026-118");
    expect(m.count).toBe(2);
  });
});

describe("exports", () => {
  const done = [{ fileName: "a.pdf", result: sampleResult }, { fileName: "b.txt", result: { status: "refused" as const, message: "Not an invoice.", cached: false } }];
  test("CSV: one row per line item, invoice fields repeated, BOM", () => {
    const csv = toCsv(done);
    expect(csv.startsWith("﻿file,vendor,")).toBe(true);
    const rows = csv.trim().split("\r\n");
    expect(rows).toHaveLength(5);
    expect(rows[1]).toBe('a.pdf,Harbor Office Supply LLC,93-1234567,HOS-2026-118,2026-10-28,2026-11-27,USD,602.5,48.2,650.7,1,"Nitrile gloves, box of 100",20,8.90,178.00,178,pass');
  });
  test("XLSX: a summary sheet and a sheet per invoice; JSON keeps the checks", () => {
    const files = unzipSync(toXlsx(done));
    expect(strFromU8(files["xl/workbook.xml"])).toContain('<sheet name="Summary"');
    expect(strFromU8(files["xl/workbook.xml"])).toContain('<sheet name="1 HOS-2026-118"');
    expect(strFromU8(files["xl/worksheets/sheet1.xml"])).toContain("Adds up");
    const json = JSON.parse(toJson(done));
    expect(json[0].checks[4]).toMatchObject({ id: "lines_vs_subtotal", status: "pass" });
    expect(json[1]).toMatchObject({ file: "b.txt", status: "refused" });
  });
});
