import { readFileSync } from "node:fs";
import { join } from "node:path";
import { setFlagsFromString } from "node:v8";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { CsvStreamParser, detectDelimiter, parseCsv } from "../src/logic/csvParser";
import { csvToJson, CsvToJsonStream, type CsvToJsonOptions } from "../src/logic/csvToJson";
import { checkFile, detectEncoding, sniffKind } from "../src/logic/input";
import { describeJsonError, parseJsonRecords, recordsToCsv, type JsonToCsvOptions } from "../src/logic/jsonToCsv";
import { flatten, unflatten } from "../src/logic/nesting";
import { DEFAULT_INFER, inferValue, normalizeHeaders } from "../src/logic/values";
import { EXAMPLE_CSV, EXAMPLE_JSON } from "../fixtures/example";

// Force a collection before each heap sample so the memory test measures retention, not GC timing.
setFlagsFromString("--expose-gc");
const collect = runInNewContext("gc") as () => void;

const bytes = (name: string) => new Uint8Array(readFileSync(join(__dirname, "..", "fixtures", name)));
const text = (name: string) => new TextDecoder().decode(bytes(name));

const CSV_OPTS: CsvToJsonOptions = {
  delimiter: "auto",
  hasHeader: true,
  infer: DEFAULT_INFER,
  nest: false,
  separator: ".",
  nestArrays: true,
  output: "array",
  indent: 0,
};
const JSON_OPTS: JsonToCsvOptions = {
  delimiter: ",",
  includeHeader: true,
  flatten: true,
  separator: ".",
  arrays: "index",
  quoteAll: false,
  lineEnding: "\n",
  protectFormulas: false,
};
const toJson = (csv: string, patch: Partial<CsvToJsonOptions> = {}) => {
  const { json, summary } = csvToJson(csv, { ...CSV_OPTS, ...patch });
  return { data: JSON.parse(json) as unknown, summary };
};

describe("encodings and delimiters", () => {
  it("strips a UTF-8 BOM and detects semicolons", () => {
    const enc = detectEncoding(bytes("bom-semicolon.csv"));
    expect(enc).toEqual({ encoding: "utf-8", bom: 3 });
    const { data, summary } = toJson(new TextDecoder("utf-8").decode(bytes("bom-semicolon.csv")));
    expect(summary.delimiter).toBe(";");
    // "4,50" is a European decimal, so it must stay text instead of becoming 4 or 450.
    expect(data).toEqual([
      { product: "Kaffee", price: "4,50", stock: 12 },
      { product: "Tee", price: "3,20", stock: 0 },
    ]);
  });

  it("falls back to Windows-1252 for non-UTF-8 files and reads UTF-16 with a BOM", () => {
    const latin = bytes("windows-1252.csv");
    expect(detectEncoding(latin).encoding).toBe("windows-1252");
    expect(toJson(new TextDecoder("windows-1252").decode(latin)).data).toEqual([
      { name: "Renée", city: "Montréal" },
      { name: "José", city: "Málaga" },
    ]);
    const u16 = bytes("utf16le.csv");
    expect(detectEncoding(u16).encoding).toBe("utf-16le");
    expect(toJson(new TextDecoder("utf-16le").decode(u16)).data).toEqual([{ name: "Zoë", country: "NL" }]);
  });

  it("does not misdetect UTF-8 when the sample cuts a multi-byte character", () => {
    const full = new TextEncoder().encode("city\nZürich\n");
    const cut = full.subarray(0, full.indexOf(0xc3) + 1);
    expect(detectEncoding(cut).encoding).toBe("utf-8");
  });

  it("detects comma, semicolon, tab and pipe", () => {
    expect(detectDelimiter("a,b,c\n1,2,3")).toBe(",");
    expect(detectDelimiter("a;b;c\n1;2,5;3")).toBe(";");
    expect(detectDelimiter("a\tb\n1\t2")).toBe("\t");
    expect(detectDelimiter(text("pipe-delimited.txt"))).toBe("|");
    expect(toJson(text("pipe-delimited.txt")).data).toEqual([
      { sku: "A-1", qty: 5, zip: "00501" },
      { sku: "B-2", qty: "0012", zip: 10001 },
    ]);
  });
});

describe("CSV parsing", () => {
  it("handles quoted fields with embedded CRLF newlines, quotes and delimiters", () => {
    const { data } = toJson(text("quoted-newlines.csv"));
    expect(data).toEqual([
      { id: 1, comment: "Line one\r\nLine two" },
      { id: 2, comment: "She said \"hi\", then left" },
      { id: 3, comment: "a|b;c\tz" },
    ]);
  });

  it("gives the same rows no matter how the text is chunked", () => {
    const src = text("quoted-newlines.csv");
    const whole = parseCsv(src, ",").rows;
    const p = new CsvStreamParser(",");
    const rows: string[][] = [];
    for (const ch of src) rows.push(...p.push(ch));
    rows.push(...p.end());
    expect(rows).toEqual(whole);
  });

  it("renames empty and duplicate headers instead of overwriting values", () => {
    expect(normalizeHeaders(["name", "", "name", "email", " "]).headers).toEqual(["name", "column_2", "name_2", "email", "column_5"]);
    const { data, summary } = toJson(text("duplicate-headers.csv"));
    expect(data).toEqual([{ name: "Ada", column_2: "x", name_2: "Lovelace", email: "ada@example.com", column_5: "y" }]);
    expect(summary.headerFixes).toHaveLength(3);
  });

  it("reports an unclosed quote", () => {
    expect(toJson("a,b\n1,\"oops\n2,3").summary.unclosedQuote).toBe(true);
  });
});

describe("type inference", () => {
  it("keeps leading zeros, long IDs and formatted numbers as text", () => {
    expect(inferValue("02134", DEFAULT_INFER)).toBe("02134");
    expect(inferValue("0", DEFAULT_INFER)).toBe(0);
    expect(inferValue("0.75", DEFAULT_INFER)).toBe(0.75);
    expect(inferValue("-12.5e3", DEFAULT_INFER)).toBe(-12500);
    expect(inferValue("4111111111111111", DEFAULT_INFER)).toBe("4111111111111111");
    expect(inferValue("1,000", DEFAULT_INFER)).toBe("1,000");
    expect(inferValue("+44", DEFAULT_INFER)).toBe("+44");
  });

  it("infers booleans and nulls, each switchable", () => {
    expect(inferValue("TRUE", DEFAULT_INFER)).toBe(true);
    expect(inferValue("null", DEFAULT_INFER)).toBe(null);
    expect(inferValue("", DEFAULT_INFER)).toBe(null);
    const off = { numbers: false, booleans: false, nulls: false, emptyAsNull: false };
    expect(["42", "true", "null", ""].map((v) => inferValue(v, off))).toEqual(["42", "true", "null", ""]);
  });

  it("converts the example exactly", () => {
    const { data } = toJson(EXAMPLE_CSV, { nest: true });
    expect(data).toEqual([
      { id: 1001, name: "Nguyen, Linh", email: "linh.nguyen@example.com", address: { city: "Boston", zip: "02134" }, newsletter: true, lifetime_value: 1249.5, notes: null },
      { id: 1002, name: "Marco Rossi", email: "marco.rossi@example.com", address: { city: "Austin", zip: 73301 }, newsletter: false, lifetime_value: 310, notes: "Prefers email\nafter 5 pm" },
      { id: 1003, name: "Aisha Bello", email: "aisha.bello@example.com", address: { city: "Newark", zip: "07102" }, newsletter: true, lifetime_value: null, notes: "Said \"call me\" twice" },
    ]);
  });
});

describe("nesting", () => {
  it("unflattens with a configurable separator and builds arrays from numeric segments", () => {
    const flat = { "user/name": "Mia", "user/tags/0": "a", "user/tags/1": "b", plain: 1 };
    expect(unflatten(flat, "/", true).value).toEqual({ user: { name: "Mia", tags: ["a", "b"] }, plain: 1 });
    expect(unflatten(flat, "/", false).value).toEqual({ user: { name: "Mia", tags: { 0: "a", 1: "b" } }, plain: 1 });
  });

  it("reports keys that conflict with an existing value", () => {
    const r = unflatten({ a: 1, "a.b": 2 }, ".", true);
    expect(r.conflicts).toEqual(["a.b"]);
    expect(r.value).toEqual({ a: 1, "a.b": 2 });
  });

  it("flattens nested JSON to CSV columns and back (round trip)", () => {
    const records = JSON.parse(text("nested.json"));
    const csv = recordsToCsv(records, JSON_OPTS).csv;
    expect(csv.split("\n")[0]).toBe("user.id,user.profile.first,user.profile.langs.0,user.profile.langs.1,active,note");
    expect(flatten(records[1], "_", "json")).toEqual({ user_id: 8, user_profile_first: "Omar", user_profile_langs: "[]", active: false, note: "=SUM(A1:A9)" });
    const back = toJson(csv, { nest: true }).data as Record<string, unknown>[];
    expect(back[0]).toEqual({ user: { id: 7, profile: { first: "Mia", langs: ["en", "de"] } }, active: true, note: null });
  });
});

describe("JSON → CSV", () => {
  it("unwraps API responses, quotes where needed and keeps column order", () => {
    const parsed = parseJsonRecords(EXAMPLE_JSON);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const out = recordsToCsv(parsed.records, JSON_OPTS);
    expect(out.csv).toBe(
      "id,total,paid,customer.name,customer.country,items.0,items.1\n" +
        "ord_8812,54.9,true,Kofi Mensah,GH,mug,tea\n" +
        "ord_8813,120,false,Elif Yılmaz,TR,kettle,\n" +
        "ord_8814,9.5,true,\"Jonas \"\"JJ\"\" Berg\",SE,,\n",
    );
  });

  it("protects against spreadsheet formulas when asked and supports other delimiters", () => {
    const records = [{ a: "=1+1", b: -5, c: "x;y" }];
    expect(recordsToCsv(records, { ...JSON_OPTS, protectFormulas: true }).csv).toBe("a,b,c\n'=1+1,-5,x;y\n");
    expect(recordsToCsv(records, { ...JSON_OPTS, delimiter: ";", lineEnding: "\r\n" }).csv).toBe("a;b;c\r\n=1+1;-5;\"x;y\"\r\n");
  });

  it("reads NDJSON and explains invalid JSON with a location", () => {
    const nd = parseJsonRecords("{\"a\":1}\n{\"a\":2}\n");
    expect(nd.ok && nd.records).toEqual([{ a: 1 }, { a: 2 }]);
    const bad = parseJsonRecords("[\n  {\"a\": 1},\n  {\"a\": 2,}\n]");
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toMatch(/line 3/);
    expect(describeJsonError("[1,", new SyntaxError("Unexpected end of JSON input"))).toContain("closing");
  });
});

describe("files", () => {
  it("checks magic bytes and the size limits", () => {
    const head = new TextEncoder().encode("a,b\n1,2");
    expect(checkFile(head, 7, "a,b")).toEqual({ ok: true, kind: "csv" });
    expect(checkFile(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), 100, "PK").ok).toBe(false);
    expect(checkFile(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), 100, "").ok).toBe(false);
    expect(checkFile(new Uint8Array([0x61, 0, 0x62]), 3, "a").ok).toBe(false);
    expect(checkFile(head, 150 * 1048576, "a,b").ok).toBe(true);
    expect(checkFile(head, 201 * 1048576, "a,b").ok).toBe(false);
    expect(checkFile(new TextEncoder().encode("[{}]"), 60 * 1048576, "[{}]").ok).toBe(false);
    expect(sniffKind("﻿  [1]")).toBe("json");
  });

  it("streams a 200 MB CSV in constant memory", () => {
    const row = "12345,\"Some, quoted text\",02134,true,3.14159,plain value here\n";
    const chunk = row.repeat(Math.floor((1024 * 1024) / row.length));
    const target = 200 * 1024 * 1024;
    let outChars = 0;
    const stream = new CsvToJsonStream({ ...CSV_OPTS, hasHeader: false }, (s) => {
      outChars += s.length;
    });
    collect();
    const before = process.memoryUsage().heapUsed;
    let fed = 0;
    let peak = 0;
    while (fed < target) {
      stream.push(chunk);
      fed += chunk.length;
      if (fed % (20 * chunk.length) === 0) {
        collect();
        peak = Math.max(peak, process.memoryUsage().heapUsed - before);
      }
    }
    const summary = stream.end();
    expect(summary.rows).toBe((fed / chunk.length) * Math.floor((1024 * 1024) / row.length));
    expect(outChars).toBeGreaterThan(fed);
    // Output is discarded here, so heap growth (GC noise included) stays well below the 200 MB processed.
    expect(peak).toBeLessThan(128 * 1024 * 1024);
  }, 60_000);
});
