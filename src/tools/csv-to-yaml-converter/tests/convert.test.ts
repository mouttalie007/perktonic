import { describe, expect, it } from "vitest";
import { convert, findRecords, parseSource, ConvertError } from "../src/logic/convert";
import { DEFAULT_OPTIONS, type ConvertOptions, type Format } from "../src/logic/options";
import { recordsToTable, rowsToRecords, typed } from "../src/logic/tree";
import { toXmlName, xmlNameProblem } from "../src/logic/xml";
import { SAMPLES } from "../fixtures/examples";

const opts = (from: Format, to: Format, extra: Partial<ConvertOptions> = {}): ConvertOptions => ({ ...DEFAULT_OPTIONS, from, to, ...extra });

describe("CSV to nested records", () => {
  it("keeps types (numbers, booleans, null), nests dotted headers and splits list columns", () => {
    expect([typed("42", true), typed("1.5", true), typed("true", true), typed("", true), typed("007", true), typed("12345678901234567890", true), typed("42", false)]).toEqual([42, 1.5, true, null, "007", "12345678901234567890", "42"]);
    const { records } = rowsToRecords(["hostname", "location.city", "location.rack", "tags[]", "port"], [["web-01", "Frankfurt", "R12", "frontend|public", "443"]], { detectTypes: true, nest: true, listSeparator: "|" });
    expect(records[0]).toEqual({ hostname: "web-01", location: { city: "Frankfurt", rack: "R12" }, tags: ["frontend", "public"], port: 443 });
  });

  it("writes YAML with quoted ambiguous strings and block scalars for multi-line text", () => {
    const y = convert(SAMPLES.csv, opts("csv", "yaml")).output;
    expect(y.startsWith("servers:\n  - hostname: web-01\n    ip: 10.0.4.11\n    port: 443\n    enabled: true\n    location:\n      city: Frankfurt\n      rack: R12\n    tags:\n      - frontend\n      - public\n")).toBe(true);
    expect(y).toContain("notes: null");
    expect(y).toContain(`notes: 'Drains at 02:00 UTC: "maintenance"'`);
    expect(y).toContain("notes: |-\n      Replica lag alerts:\n      page the on-call");
    expect(y).toContain("tags: []");
  });
});

describe("XML", () => {
  it("validates element names and writes child elements or attributes, escaping text", () => {
    expect(xmlNameProblem("2024")).toMatch(/cannot start with a digit/);
    expect(xmlNameProblem("my row")).toMatch(/may only contain/);
    expect(xmlNameProblem("xmlData")).toMatch(/reserved/);
    expect(xmlNameProblem("server")).toBeNull();
    expect(toXmlName("Unit Price (€)")).toBe("Unit_Price_€_");
    expect(() => convert(SAMPLES.csv, opts("csv", "xml", { xmlRoot: "my servers" }))).toThrow(ConvertError);
    const x = convert("id,Unit Price,note\n1,9.5,a < b & c\n", opts("csv", "xml", { xmlRoot: "items", xmlRow: "item" }));
    expect(x.output).toBe('<?xml version="1.0" encoding="UTF-8"?>\n<items>\n  <item>\n    <id>1</id>\n    <Unit_Price>9.5</Unit_Price>\n    <note>a &lt; b &amp; c</note>\n  </item>\n</items>\n');
    expect(x.notes[0]).toMatch(/“Unit Price” → <Unit_Price>/);
    const a = convert('id,label\n1,"say ""hi"""\n', opts("csv", "xml", { xmlRoot: "items", xmlRow: "item", xmlAttributes: true })).output;
    expect(a).toContain('<item id="1" label="say &quot;hi&quot;"/>');
  });

  it("reads XML attributes and nested elements back into dotted columns, with types", () => {
    const r = convert(SAMPLES.xml, opts("xml", "csv"));
    expect(r.table?.headers).toEqual(["title", "price", "author.first", "author.last", "in_stock", "id", "lang"]);
    expect(r.table?.rows[1]).toEqual(["Midnight & Rain", "5.95", "Kim", "Ralls", "false", "bk102", "fr"]);
    expect(r.notes[0]).toBe("Rows were taken from “catalog.book” (2 items).");
    expect(() => parseSource('<?xml version="1.0"?><!DOCTYPE a [<!ENTITY x "y">]><a>&x;</a>', "xml", true)).toThrow(/DOCTYPE/);
    expect(() => parseSource("<a><b></a>", "xml", true)).toThrow(ConvertError);
  });
});

describe("YAML and TOML back to CSV", () => {
  it("resolves YAML anchors, aliases and merge keys, and keeps multi-line strings", () => {
    const r = convert(SAMPLES.yaml, opts("yaml", "csv"));
    expect(r.table?.headers).toEqual(["name", "region", "backup", "ports", "motd"]);
    expect(r.table?.rows).toEqual([
      ["web-01", "eu-west-1", "true", "80|443", "Welcome to web-01.\nChanges are logged.\n"],
      ["db-01", "eu-west-1", "false", "5432", ""],
    ]);
    expect(r.notes).toContain("Not included: “defaults”. A CSV holds one table, so only the largest list became rows.");
    const bomb = "a: &a [x,x,x,x,x,x,x,x,x]\nb: &b [*a,*a,*a,*a,*a,*a,*a,*a,*a]\nc: &c [*b,*b,*b,*b,*b,*b,*b,*b,*b]\nd: &d [*c,*c,*c,*c,*c,*c,*c,*c,*c]\ne: &e [*d,*d,*d,*d,*d,*d,*d,*d,*d]\nf: [*e,*e,*e,*e,*e,*e,*e,*e,*e]";
    expect(() => parseSource(bomb, "yaml", true)).toThrow(/alias/);
    expect(() => parseSource("a: [1, 2\nb: 3", "yaml", true)).toThrow(ConvertError);
  });

  it("reads TOML arrays of tables and sub-tables, and writes TOML without nulls (reported)", () => {
    const r = convert(SAMPLES.toml, opts("toml", "csv"));
    expect(r.table?.headers).toEqual(["version", "date", "stable", "features", "owner.name", "owner.team"]);
    expect(r.table?.rows[0]).toEqual(["2.4.0", "2026-11-03", "true", "dark mode|export", "Ana", "web"]);
    expect(r.notes).toContain("Not included: “title”. A CSV holds one table, so only the largest list became rows.");
    const t = convert(SAMPLES.csv, opts("csv", "toml"));
    expect(t.output.startsWith('[[servers]]\nhostname = "web-01"\nip = "10.0.4.11"\nport = 443\nenabled = true\ntags = [ "frontend", "public" ]\nowner = "platform"\n')).toBe(true);
    expect(t.output).toContain("[servers.location]");
    expect(t.notes).toContain("1 empty cell was left out: TOML has no null, so a missing key is the only way to say “no value”.");
  });
});

describe("round trips and losses", () => {
  it("CSV → YAML/XML/TOML → CSV gives back the same table", () => {
    const original = convert(convert(SAMPLES.csv, opts("csv", "yaml")).output, opts("yaml", "csv"));
    expect(original.table?.headers).toEqual(["hostname", "ip", "port", "enabled", "location.city", "location.rack", "tags", "owner", "notes"]);
    expect(original.table?.rows[3]).toEqual(["cache-01", "10.0.9.5", "6379", "true", "Dublin", "R04", "", "platform", "007 is the asset tag"]);
    const viaXml = convert(convert(SAMPLES.csv, opts("csv", "xml")).output, opts("xml", "csv"));
    expect(viaXml.table?.rows.map((r) => r[0])).toEqual(["web-01", "web-02", "db-01", "cache-01"]);
    expect(viaXml.table?.rows[1][8]).toBe('Drains at 02:00 UTC: "maintenance"');
  });

  it("says what is lost when a structure cannot be a table", () => {
    const t = recordsToTable([{ id: 1, items: [{ sku: "A", qty: 2 }], tags: ["a|b", "c"] }], "|");
    expect(t.rows[0]).toEqual(["1", '[{"sku":"A","qty":2}]', "a|b|c"]);
    expect(t.losses).toHaveLength(2);
    expect(t.losses[0]).toMatch(/list of objects or nested lists/);
    expect(t.losses[1]).toMatch(/contain the list separator/);
    const circular = parseSource("a: &a\n  self: *a\n", "yaml", true);
    expect(recordsToTable([circular], "|").losses[0]).toMatch(/refers back to itself/);
    expect(findRecords({ only: { one: { a: 1, b: 2 } } })).toEqual({ records: [{ a: 1, b: 2 }], path: "only.one", skipped: [] });
  });
});

describe("YAML writer", () => {
  it("writes strings that YAML 1.1 and 1.2 parsers read back unchanged", async () => {
    const YAML = (await import("yaml")).default;
    const { toYaml } = await import("../src/logic/yamlWriter");
    const tricky = ["yes", "No", "on", "OFF", "y", "~", "null", "007", "1e3", "0x1F", ".inf", "12:30", "2026-01-01", "2026-01-01T10:00:00Z", "- x", "a: b", "a:", "#x", "x #y", "", " lead", "trail ", "multi\nline", "ends\n", "two\n\n", "\nfirst empty", "  indented\nline", "tab\tx", "quote'", 'dq"', "[a]", "{b}", "@x", "%x", "!x", "&x", "*x", "|x", ">x", "?x", ",x", "`x", "ü ñ 中文", "bell\u0007", "crlf\r\nx", "=", "<<", "plain text, with comma"];
    const records = tricky.map((v, i) => ({ id: i, value: v, list: [v, 1, true, null], nested: { v } }));
    const text = toYaml(records, "rows");
    for (const version of ["1.1", "1.2"] as const) {
      expect(YAML.parse(text, { version })).toEqual({ rows: records });
    }
    expect(toYaml([], "")).toBe("[]\n");
    expect(toYaml([{ a: [], b: {} }], "")).toBe("- a: []\n  b: {}\n");
  });
});
