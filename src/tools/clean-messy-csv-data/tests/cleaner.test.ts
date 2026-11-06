import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import readXlsxFile from "read-excel-file/node";
import { detectDelimiter, parseCsv } from "../src/logic/csvParser";
import { toCsv } from "../src/logic/csvWriter";
import { analyzeDateColumn, classifyDate, convertDate } from "../src/logic/dates";
import { decodeBytes, detectEncoding, repairMojibake } from "../src/logic/encoding";
import { normalizeHeaders, styleHeader } from "../src/logic/headers";
import { cellToText, checkFile } from "../src/logic/input";
import { cleanTable, DEFAULT_CLEAN_OPTIONS, STEP_ORDER, type CleanOptions, type StepId } from "../src/logic/pipeline";
import { normalizeSpaces, removeInvisible, straightenQuotes, visible } from "../src/logic/text";
import { EXAMPLE_CSV } from "../fixtures/example";

const raw = (name: string) => new Uint8Array(readFileSync(join(__dirname, "..", "fixtures", name)));
const grid = (text: string) => parseCsv(text, detectDelimiter(text)).rows.filter((r) => !(r.length === 1 && r[0] === ""));
const opts = (patch: Partial<CleanOptions> = {}, steps: Partial<Record<StepId, boolean>> = {}): CleanOptions => ({
  ...DEFAULT_CLEAN_OPTIONS,
  ...patch,
  steps: { ...DEFAULT_CLEAN_OPTIONS.steps, ...steps },
});
const onlySteps = (...ids: StepId[]) => Object.fromEntries(STEP_ORDER.map((s) => [s, ids.includes(s)])) as Record<StepId, boolean>;

describe("encoding detection", () => {
  it("detects Windows-1256 Arabic and decodes it correctly", () => {
    const bytes = raw("windows-1256-arabic.csv");
    const guess = detectEncoding(bytes);
    expect(guess.encoding).toBe("windows-1256");
    const text = decodeBytes(bytes, guess.encoding);
    expect(grid(text)[1]).toEqual(["محمد علي", "القاهرة", "0100123456"]);
  });

  it("detects ISO-8859-1 and UTF-8, and a manual override changes the result", () => {
    const latin = raw("iso-8859-1.csv");
    expect(detectEncoding(latin).encoding).toBe("iso-8859-1");
    expect(grid(decodeBytes(latin, "iso-8859-1"))[2]).toEqual(["Jürgen Groß", "Köln", "größer"]);
    // Forcing the wrong encoding is allowed (manual override) and visibly changes the text.
    expect(grid(decodeBytes(latin, "windows-1256"))[2][0]).not.toBe("Jürgen Groß");
    expect(detectEncoding(new TextEncoder().encode("name\nZoë\n")).encoding).toBe("utf-8");
    expect(detectEncoding(new Uint8Array([0xef, 0xbb, 0xbf, 0x61])).reason).toMatch(/byte order mark/);
  });

  it("repairs UTF-8 text that was decoded as Windows-1252 (mojibake)", () => {
    const rows = grid(new TextDecoder().decode(raw("utf8-mojibake.csv")));
    expect(repairMojibake(rows[1][0])).toBe("Café au lait");
    expect(repairMojibake(rows[2][0])).toBe("مرحبا");
    expect(repairMojibake("Plain text")).toBe("Plain text");
    // Real Latin-1 words are not "repaired" into something else.
    expect(repairMojibake("Ãrvore São Paulo")).toBe("Ãrvore São Paulo");
  });
});

describe("invisible characters", () => {
  it("removes zero-width characters but keeps ZWNJ/ZWJ, and normalises odd spaces and smart quotes", () => {
    expect(removeInvisible("USB​ cable﻿")).toBe("USB cable");
    expect(removeInvisible("می‌خواهم")).toBe("می‌خواهم");
    expect(normalizeSpaces("Chen Wei !")).toBe("Chen Wei !");
    expect(straightenQuotes("“Pro” it’s «ok»")).toBe("\"Pro\" it's «ok»");
    expect(visible(" a​b ")).toBe("·a⟨ZWSP⟩b·");
  });

  it("cleans the invisible-characters fixture with exact per-step counts", () => {
    const text = new TextDecoder().decode(raw("invisible-chars.csv"));
    const res = cleanTable(grid(text), opts({ headerStyle: "trim" }));
    expect(res.rows).toEqual([
      ["A-1", "Desk lamp", "19.90"],
      ["A-2", "USB cable", "4.50"],
      ["A-3", "\"Pro\" mouse", "25"],
      ["A-4", "It's fine", ""],
    ]);
    expect(res.report.counts).toMatchObject({ invisible: 1, spaces: 1, quotes: 2, trim: 1, blanks: 1 });
    expect(res.report.cellsModified).toBe(5);
  });
});

describe("dates", () => {
  it("never guesses an ambiguous column; it asks", () => {
    const res = cleanTable(grid(new TextDecoder().decode(raw("dates-ambiguous.csv"))), opts());
    const col = res.report.dateColumns.find((d) => d.name === "order_date");
    expect(col?.needsDecision).toBe(true);
    expect(col?.status.kind).toBe("ambiguous");
    expect(res.report.counts.dates).toBe(0);
    expect(res.rows.map((r) => r[1])).toEqual(["03/04/2026", "05/06/2026", "2026-01-15", ""]);
  });

  it("applies the user's DD/MM or MM/DD answer", () => {
    const g = grid(new TextDecoder().decode(raw("dates-ambiguous.csv")));
    const dmy = cleanTable(g, opts({ dateOrders: { 1: "dmy" } }));
    expect(dmy.rows.map((r) => r[1])).toEqual(["2026-04-03", "2026-06-05", "2026-01-15", ""]);
    const mdy = cleanTable(g, opts({ dateOrders: { 1: "mdy" } }));
    expect(mdy.rows.map((r) => r[1])).toEqual(["2026-03-04", "2026-05-06", "2026-01-15", ""]);
    expect(mdy.report.counts.dates).toBe(2);
  });

  it("uses only proof from the data (25/03 must be DD/MM) and leaves invalid dates untouched", () => {
    const res = cleanTable(grid(new TextDecoder().decode(raw("dates-dmy.csv"))), opts());
    const col = res.report.dateColumns[0];
    expect(col.status).toEqual({ kind: "detected", order: "dmy", evidence: "25/03/2026" });
    expect(res.rows.map((r) => r[1])).toEqual(["2026-03-25", "2026-04-03", "31/02/2026", "2026-07-14", "2026-01-01"]);
    expect(col.unparsed).toBe(1);
    expect(col.converted).toBe(4);
  });

  it("flags columns that mix both orders", () => {
    expect(analyzeDateColumn(["25/03/2026", "03/25/2026"]).kind).toBe("mixed");
    expect(classifyDate("05/05/2026").kind).toBe("fixed");
    expect(convertDate("Apr 3, 2026", null, "iso")).toBe("2026-04-03");
    expect(convertDate("3 April 2026", null, "dmy")).toBe("03/04/2026");
    expect(convertDate("12/31/2025 9:05 PM", "mdy", "iso")).toBe("2025-12-31 21:05");
    expect(analyzeDateColumn(["A-12", "B-7", "03/04/2026"]).kind).toBe("not-date");
  });
});

describe("headers and duplicates", () => {
  it("normalises header names in several styles, keeping non-Latin letters", () => {
    expect(styleHeader(" Customer  Name ", "snake")).toBe("customer_name");
    expect(styleHeader("orderDate (UTC)", "snake")).toBe("order_date_utc");
    expect(styleHeader("monthly_fee", "title")).toBe("Monthly Fee");
    expect(styleHeader("الاسم الكامل", "snake")).toBe("الاسم_الكامل");
    expect(normalizeHeaders(["Email", "", "email", "E-mail"], "snake")).toEqual(["email", "column_2", "email_2", "e_mail"]);
  });

  it("removes duplicate rows after cleaning, keeping the first", () => {
    const g = [["name", "city"], ["Ana", "Rio"], [" Ana ", "Rio"], ["ana", "rio"]];
    expect(cleanTable(g, opts()).report.counts.duplicates).toBe(1);
    const res = cleanTable(g, opts({ dedupeIgnoreCase: true }));
    expect(res.rows).toEqual([["Ana", "Rio"]]);
    expect(res.report.changes.filter((c) => c.step === "duplicates").map((c) => c.before)).toEqual(["duplicate of row 2", "duplicate of row 2"]);
  });
});

describe("report accuracy", () => {
  it("every change in the report is real and the counts add up (example data)", () => {
    const input = grid(EXAMPLE_CSV);
    const res = cleanTable(input, opts({ dateOrders: { 3: "dmy" } }));
    const r = res.report;

    // Replaying the listed cell changes on the original grid reproduces every cleaned cell.
    const replay = input.map((row) => row.slice());
    for (const c of r.changes) {
      if (c.col < 0) continue;
      expect(replay[c.row - 1][c.col]).toBe(c.before);
      replay[c.row - 1][c.col] = c.after;
    }
    res.rows.forEach((row, i) => {
      const orig = res.rowNumbers[i] - 1;
      row.forEach((v, j) => expect(v).toBe(replay[orig][res.columnIndexes[j]]));
    });
    res.header!.forEach((h, j) => expect(h).toBe(replay[0][res.columnIndexes[j]]));

    // Counts equal the listed changes, and the modified-cell total equals an independent diff.
    for (const step of STEP_ORDER) expect(r.counts[step]).toBe(r.changes.filter((c) => c.step === step).length);
    let diff = 0;
    input.forEach((row, i) => row.forEach((v, j) => (v !== replay[i][j] ? diff++ : 0)));
    expect(r.cellsModified).toBe(diff);
    expect(r.rowsOut).toBe(r.rowsIn - r.rowsRemoved);
    expect(r.counts).toMatchObject({ duplicates: 1, emptyRows: 1, dates: 9, blanks: 2, headers: 6 });
    expect(res.rows[0]).toEqual(["Ana Souza", "ana.souza@example.com", "2026-03-25", "2026-04-03", "Pro", "49"]);
  });

  it("switching a step off removes exactly its changes", () => {
    const input = grid(EXAMPLE_CSV);
    const all = cleanTable(input, opts());
    const noQuotes = cleanTable(input, opts({}, { quotes: false }));
    expect(noQuotes.report.counts.quotes).toBe(0);
    expect(all.report.counts.quotes).toBe(2);
    expect(noQuotes.rows[1][4]).toBe("“Starter”");
    const none = cleanTable(input, opts({}, onlySteps()));
    expect(none.report.cellsModified).toBe(0);
    expect(none.rows.length).toBe(input.length - 1);
  });
});

describe("files and output", () => {
  it("validates magic bytes and size", () => {
    expect(checkFile(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), 10)).toEqual({ ok: true, kind: "xlsx" });
    expect(checkFile(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]), 10).ok).toBe(false);
    expect(checkFile(new Uint8Array([0x61, 0x00]), 2).ok).toBe(false);
    expect(checkFile(new TextEncoder().encode("a"), 51 * 1048576).ok).toBe(false);
    expect(checkFile(raw("windows-1256-arabic.csv"), 100)).toEqual({ ok: true, kind: "text" });
  });

  it("reads .xlsx sheets and writes valid CSV back", async () => {
    const sheets = await readXlsxFile(join(__dirname, "..", "fixtures", "contacts.xlsx"));
    const g = sheets[0].data.map((r) => r.map(cellToText));
    const res = cleanTable(g, opts());
    expect(res.header).toEqual(["full_name", "joined", "score"]);
    const csv = toCsv(res.header, res.rows, ",");
    expect(csv).toBe("full_name,joined,score\r\n\"Doe, Jane\",2026-03-25,7.5\r\nSam Lee,2026-01-02,\r\n");
  });
});
