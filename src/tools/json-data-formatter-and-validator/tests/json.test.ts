import { describe, expect, it } from "vitest";
import { formatJson, pathString, resolvePointer, stats, treeChildren } from "../src/logic/format";
import { JsonSyntaxError, locate, parseJson, pointer } from "../src/logic/parser";
import { detectDraft, validateSchema } from "../src/logic/schema";
import { BROKEN_JSON, DRAFT7_SCHEMA, EXAMPLE_JSON, EXAMPLE_SCHEMA, JSONC } from "../fixtures/examples";

const parse = (src: string, lenient = false) => parseJson(src, { lenient });
const syntax = (src: string, lenient = false) => {
  try {
    parse(src, lenient);
  } catch (e) {
    if (e instanceof JsonSyntaxError) return { message: e.message, ...locate(src, e.offset) };
  }
  throw new Error("expected a syntax error");
};

describe("syntax errors", () => {
  it("reports line and column with a pointer", () => {
    const e = syntax(BROKEN_JSON);
    expect(e).toMatchObject({ line: 4, column: 3 });
    expect(e.message).toBe("Expected a comma or } after the value, but found the start of another string. A comma is probably missing.");
    expect(pointer(e.lineText, e.column)).toBe('  "total": 129.9\n  ^');
  });

  it("explains the usual mistakes in plain words", () => {
    expect(syntax("{'a': 1}").message).toMatch(/double quotes/);
    expect(syntax("{a: 1}").message).toMatch(/Object keys must be in double quotes/);
    expect(syntax('{"a": 1').message).toMatch(/ends too early.*closing \}/);
    expect(syntax('{"a": NaN}').message).toMatch(/NaN is not valid JSON/);
    expect(syntax('{"a": True}').message).toMatch(/Use true instead/);
    expect(syntax("[007]").message).toMatch(/leading zeros/);
    expect(syntax('{"a": 1} {"b": 2}').message).toMatch(/after the end of the JSON/);
    expect(syntax('"line\nbreak"').message).toMatch(/past the end of the line/);
    const long = syntax(`[${"1,".repeat(200)} x]`);
    expect(pointer(long.lineText, long.column).split("\n")[0].length).toBeLessThanOrEqual(101);
  });
});

describe("lossless numbers and formatting", () => {
  it("keeps integers above 2^53 and decimal digits exactly", () => {
    const { root } = parse(EXAMPLE_JSON);
    const out = formatJson(root, { indent: 2, sortKeys: false });
    expect(out).toContain('"id": 9007199254740993');
    expect(out).toContain('"total": 129.90');
    expect(JSON.stringify(JSON.parse(EXAMPLE_JSON).id)).toBe("9007199254740992");
    expect(stats(root).bigIntegers).toBe(1);
  });

  it("beautifies, minifies and keeps escapes as written", () => {
    const src = '{ "b": [1, {"x": "caf\\u00e9"}], "a": {} }';
    expect(formatJson(parse(src).root, { indent: null, sortKeys: false })).toBe('{"b":[1,{"x":"caf\\u00e9"}],"a":{}}');
    expect(formatJson(parse(src).root, { indent: 4, sortKeys: false })).toBe('{\n    "b": [\n        1,\n        {\n            "x": "caf\\u00e9"\n        }\n    ],\n    "a": {}\n}\n');
    expect(formatJson(parse("[1]").root, { indent: "tab", sortKeys: false })).toBe("[\n\t1\n]\n");
  });

  it("sorts keys recursively and stably, keeping numeric-looking keys in string order", () => {
    const { root } = parse('{"b":1,"10":2,"a":{"z":1,"y":2},"2":3,"a2":0}');
    expect(formatJson(root, { indent: null, sortKeys: true })).toBe('{"10":2,"2":3,"a":{"y":2,"z":1},"a2":0,"b":1}');
    const dup = parse('{"k":1,"j":0,"k":2}');
    expect(dup.notes.duplicateKeys).toEqual([{ key: "k", at: 13 }]);
    expect(formatJson(dup.root, { indent: null, sortKeys: true })).toBe('{"j":0,"k":1,"k":2}');
  });
});

describe("JSONC", () => {
  it("flags comments and trailing commas, and accepts them in lenient mode", () => {
    const e = syntax(JSONC);
    expect(e.line).toBe(2);
    expect(e.message).toMatch(/Comments are not allowed.*JSONC/);
    const { root, notes } = parse(JSONC, true);
    expect(notes).toMatchObject({ comments: 2, trailingCommas: 2 });
    expect(formatJson(root, { indent: null, sortKeys: false })).toBe('{"format":"csv","columns":["id","email"]}');
    expect(syntax('[1,2,]').message).toMatch(/Trailing commas are not allowed/);
  });
});

describe("JSON Schema", () => {
  it("validates against draft 2020-12 (detected from $schema)", () => {
    const r = validateSchema(parse(EXAMPLE_JSON).root, parse(EXAMPLE_SCHEMA).root, "auto");
    expect(r).toEqual({ valid: true, draft: "2020-12", issues: [] });
    const bad = '{"id":"A1","status":"lost","items":[{"sku":"X","qty":0}],"customer":{"email":"nope"}}';
    const res = validateSchema(parse(bad).root, parse(EXAMPLE_SCHEMA).root, "auto");
    expect(res.issues.map((i) => `${i.path}: ${i.message}`)).toEqual([
      "$.id: Expected integer, got string.",
      expect.stringMatching(/^\$\.status: /),
      "$.items[0].qty: 0 is less than 1.",
      expect.stringMatching(/^\$\.customer\.email: .*email/),
    ]);
    expect(locate(bad, res.issues[2].offset)).toMatchObject({ line: 1 });
  });

  it("validates against draft-07 and reports additionalProperties without echoes", () => {
    expect(detectDraft(JSON.parse(DRAFT7_SCHEMA))).toBe("7");
    const doc = '{\n  "port": 70000,\n  "hosts": [],\n  "debug": true\n}';
    const res = validateSchema(parse(doc).root, parse(DRAFT7_SCHEMA).root, "auto");
    expect(res.draft).toBe("7");
    expect(res.issues.map((i) => [i.path, i.message, locate(doc, i.offset).line])).toEqual([
      ["$.port", expect.stringMatching(/70000/), 2],
      ["$.hosts", expect.stringMatching(/minimum|1/i), 3],
      ["$.debug", 'Property "debug" is not allowed (additionalProperties is false).', 4],
    ]);
    const missing = validateSchema(parse('{"port": 1}').root, parse(DRAFT7_SCHEMA).root, "7");
    expect(missing.issues.map((i) => i.message)).toEqual(['Required property "hosts" is missing.']);
  });
});

describe("tree view and paths", () => {
  it("builds copyable paths like $.a[0].b, with brackets for odd keys", () => {
    expect(pathString(["items", 0, "sku"])).toBe("$.items[0].sku");
    expect(pathString(["first name", "it's"])).toBe("$['first name']['it\\'s']");
    const { root } = parse(EXAMPLE_JSON);
    const top = treeChildren(root, [], []);
    expect(top.total).toBe(8);
    expect(top.children.map((c) => `${c.path} ${c.summary}`)).toContain("$.items [2 items]");
    const items = treeChildren(root, [5], ["items"]);
    expect(items.children[1]).toMatchObject({ path: "$.items[1]", summary: "{3 keys}", expandable: true });
    expect(treeChildren(root, [5, 1], ["items", 1]).children[2]).toMatchObject({ path: "$.items[1].price", summary: "100.00" });
    expect(resolvePointer(root, "/customer/email")?.steps).toEqual(["customer", "email"]);
  });

  it("parses a 50 MB document", { timeout: 60_000 }, () => {
    const record = '{"id":123456789012345678,"name":"Jürgen Ölmann","tags":["a","b"],"score":12.5,"active":true,"note":null},';
    const count = Math.ceil((50 * 1024 * 1024) / record.length);
    const src = `[${record.repeat(count).slice(0, -1)}]`;
    expect(src.length).toBeGreaterThanOrEqual(50 * 1024 * 1024);
    const { root } = parse(src);
    expect(root.t === "array" && root.items.length).toBe(count);
    expect(stats(root).bigIntegers).toBe(count);
    expect(formatJson(root, { indent: null, sortKeys: false }).length).toBe(src.length);
  });
});
