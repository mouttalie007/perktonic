import { beforeAll, describe, expect, it } from "vitest";
import { JSONPath } from "jsonpath-plus";
import { loadJq, type Jq } from "jq-wasm";
import { checkFile, decodeJsonBytes, describeValue, firstJsonErrorIndex, locateJsonError, parseJson } from "../src/logic/input";
import { countJqOutputs, friendlyJqError } from "../src/logic/jq-errors";
import { explainJq } from "../src/logic/jq-explain";
import { ExpressionError, explainJsonPath } from "../src/logic/jsonpath-explain";
import { MAX_EXPRESSION_CHARS, timeLimitMs } from "../src/logic/limits";
import { runJq, runJsonPath } from "../src/logic/run";
import { EXAMPLES, SAMPLE_JSON } from "../fixtures/examples";

let jq: Jq;
beforeAll(async () => {
  jq = await loadJq();
});

const doc = JSON.parse(SAMPLE_JSON);
const texts = (steps: { text: string }[]) => steps.map((s) => s.text);

describe("JSONPath", () => {
  it("explains an expression step by step", () => {
    expect(texts(explainJsonPath("$.orders[?(@.status == 'shipped' && @.total >= 50)].customer.name"))).toEqual([
      "Start at the root of the document.",
      "Go into the property “orders”.",
      "Keep only the items where “status” equals \"shipped\" and “total” is at least 50.",
      "Go into the property “customer”.",
      "Go into the property “name”.",
    ]);
    expect(texts(explainJsonPath("$..items[-1:]"))).toEqual(["Start at the root of the document.", "Search at every depth for properties named “items”.", "Take the last item."]);
    expect(texts(explainJsonPath("$.orders[:2]")).at(-1)).toBe("Take the first 2 items.");
    expect(texts(explainJsonPath("$.orders[?(!@.gift)]")).at(-1)).toBe("Keep only the items where “gift” is missing, empty, 0, false or null.");
    expect(texts(explainJsonPath("$.orders.*~")).at(-1)).toBe("Return the property names (or indexes) of the matches instead of their values.");
  });

  it("reports syntax mistakes that jsonpath-plus would silently ignore, with a position", () => {
    const bad: [string, RegExp, number][] = [
      ["$.orders[", /never closed/, 9],
      ["$.orders.", /ends with “\.”/, 9],
      ["$.orders[]", /Empty brackets/, 9],
      ["$.my orders", /Unexpected space/, 5],
      ["@.price", /only works inside a filter/, 1],
      ["$.orders[abc]", /not a valid selector/, 9],
    ];
    for (const [expr, re, column] of bad) {
      const r = runJsonPath(JSONPath, doc, expr, true);
      expect(r.error?.message, expr).toMatch(re);
      expect(r.error?.column, expr).toBe(column);
    }
    expect(() => explainJsonPath("$." + "a".repeat(MAX_EXPRESSION_CHARS))).toThrow(ExpressionError);
  });

  it("runs every example and returns the path of each match", () => {
    const shipped = runJsonPath(JSONPath, doc, EXAMPLES.jsonpath[0].expression, true);
    expect(shipped.output).toBe("\"Ada Lovelace\"\n\"Katherine Johnson\"");
    expect(shipped.paths).toEqual(["$['orders'][0]['customer']['name']", "$['orders'][2]['customer']['name']"]);
    expect(runJsonPath(JSONPath, doc, "$..sku", true).count).toBe(5);
    expect(runJsonPath(JSONPath, doc, "$..items[?(@.price > 20)].name", false).output).toBe("[\n  \"Earl Grey, 100 g\",\n  \"Gift set\"\n]");
    for (const e of EXAMPLES.jsonpath) expect(runJsonPath(JSONPath, doc, e.expression, true).count, e.expression).toBeGreaterThan(0);
  });

  it("evaluates filters without eval, and refuses code that tries to escape", () => {
    (globalThis as { pwned?: boolean }).pwned = false;
    const r = runJsonPath(JSONPath, doc, "$..[?(@.constructor.constructor('globalThis.pwned = true')())]", true);
    expect(r.error).not.toBeNull();
    expect((globalThis as { pwned?: boolean }).pwned).toBe(false);
    expect(runJsonPath(JSONPath, doc, "$.orders[?(@.total >)]", true).error?.hint).toMatch(/Filters look like/);
  });
});

describe("jq", () => {
  it("explains a pipeline, including nested map, select and object construction", () => {
    const steps = explainJq(EXAMPLES.jq[2].expression);
    expect(steps.map((s) => [s.depth, s.text])).toEqual([
      [0, "Take “orders”."],
      [0, "Group the items into arrays that share the same “customer” → “country” (groups sorted by it)."],
      [0, "For each item of the array, run the steps below and collect the results into a new array:"],
      [1, "Build a new object with the keys “country” (from item 0 → “customer” → “country”), “revenue” = `(map(.total) | add)`."],
    ]);
    expect(texts(explainJq(".orders[] | select(.status == \"shipped\") | .customer.name"))).toEqual([
      "Take “orders” → each item (one output for each).",
      "Keep only the inputs where “status” equals \"shipped\"; drop the others.",
      "Take “customer” → “name”.",
    ]);
    expect(texts(explainJq("reduce .orders[] as $o (0; . + $o.total)"))[0]).toMatch(/^Combine all outputs of “orders” → each item into one value: start with 0/);
    expect(texts(explainJq("def double: . * 2; .orders[].total | double # comment"))[0]).toBe("Define a function double; it runs `. * 2` when called.");
    expect(texts(explainJq(".a // \"none\""))[0]).toBe("Use “a”; if that is null, false or missing, use \"none\" instead.");
  });

  it("runs the examples with jq 1.8 and keeps big numbers exact", () => {
    expect(runJq(jq, SAMPLE_JSON, EXAMPLES.jq[3].expression, { compact: true, raw: false }).output).toBe("9");
    expect(runJq(jq, SAMPLE_JSON, EXAMPLES.jq[5].expression, { compact: true, raw: false }).output).toBe("{\"shipped\":2,\"pending\":1}");
    const csv = runJq(jq, SAMPLE_JSON, EXAMPLES.jq[4].expression, { compact: false, raw: true });
    expect(csv.output.split("\n")[0]).toBe("\"ORD-1042\",\"ada@example.com\",54.5");
    expect(runJq(jq, "{\"id\": 12345678901234567890}", ".id", { compact: true, raw: false }).output).toBe("12345678901234567890");
    const pretty = runJq(jq, SAMPLE_JSON, ".orders[] | {id}", { compact: false, raw: false });
    expect(pretty.count).toBe(3);
    expect(countJqOutputs("{\n  \"a\": [\n    1\n  ]\n}\n2", false)).toBe(2);
  });

  it("explains jq errors with a pointer and a hint", () => {
    const quote = runJq(jq, SAMPLE_JSON, ".orders[] | select(.status == 'x')", { compact: true, raw: false }).error!;
    expect(quote.hint).toMatch(/double quotes/);
    expect(quote.pointer).toBe(".orders[] | select(.status == 'x')\n                              ^");
    expect(runJq(jq, SAMPLE_JSON, "limit(1, .orders[])", { compact: true, raw: false }).error?.hint).toMatch(/separated with ; not with ,/);
    expect(runJq(jq, SAMPLE_JSON, ".orders | .name", { compact: true, raw: false }).error?.hint).toMatch(/Add \[\] to go through the items/);
    expect(runJq(jq, SAMPLE_JSON, ".orders[] | .foo[]", { compact: true, raw: false }).error?.hint).toMatch(/missing or misspelled/);
    expect(runJq(jq, SAMPLE_JSON, "map(.x", { compact: true, raw: false }).error?.hint).toMatch(/ends too early/);
    expect(friendlyJqError("jq: error: $o is not defined at <top-level>, line 1, column 13:\n    .orders[] | $o\n                ^^\njq: 1 compile error", ".orders[] | $o").hint).toMatch(/as \$o/);
    // Output produced before a runtime error is kept.
    const partial = runJq(jq, "[1, \"a\", 3]", ".[] | . + 1", { compact: true, raw: false });
    expect(partial.output).toBe("2");
    expect(partial.error?.message).toMatch(/cannot be added/);
  });
});

describe("input and limits", () => {
  it("locates JSON errors, checks magic bytes and decodes BOMs", () => {
    const bad = "{\n  \"a\": 1,\n  \"b\": 'x'\n}";
    const r = parseJson(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.line).toBe(3);
      expect(r.error.message).toMatch(/double quotes/);
    }
    expect(locateJsonError("[1,2", "JSON.parse: end of data after list element at line 1 column 5 of the JSON data")).toMatchObject({ line: 1, column: 5 });
    expect(locateJsonError("[1,\n2,]", "Unexpected token ']', \"[1,\n2,]\" is not valid JSON")).toMatchObject({ line: 2, column: 3, message: expect.stringMatching(/trailing comma/) });
    expect([`{"a": [1, {"b": null}], "c": "\\u00e9"}`, "  42 ", "[]"].map(firstJsonErrorIndex)).toEqual([-1, -1, -1]);
    expect(["{\"a\" 1}", "[1 2]", "{} x", "[\"tab\there\"]", "[01]", ""].map(firstJsonErrorIndex)).toEqual([5, 3, 3, 5, 2, 0]);
    expect(checkFile(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), 10)).toMatchObject({ ok: false });
    expect(checkFile(new Uint8Array([0x7b, 0x00, 0x7d]), 3)).toMatchObject({ ok: false });
    expect(checkFile(new Uint8Array([0x7b]), 60 * 1024 * 1024)).toMatchObject({ ok: false, error: expect.stringMatching(/limit is 50 MB/) });
    expect(decodeJsonBytes(new Uint8Array([0xff, 0xfe, 0x5b, 0x00, 0x5d, 0x00]))).toBe("[]");
    expect(describeValue(doc.orders)).toBe("an array of 3 items");
    expect(timeLimitMs(1000)).toBe(2000);
    expect(timeLimitMs(20 * 1024 * 1024)).toBe(6500);
  });

  it("handles a 20 MB document with both JSONPath and jq", () => {
    const orders = Array.from({ length: 240_000 }, (_, i) => ({ id: i, name: `Customer ${i}`, email: `c${i}@example.com`, country: ["US", "DE", "IN", "FR"][i % 4], total: (i * 7) % 500 }));
    const text = JSON.stringify({ orders });
    expect(text.length).toBeGreaterThan(20_000_000);
    const big = JSON.parse(text);
    const jp = runJsonPath(JSONPath, big, "$.orders[?(@.country == 'DE')].id", true);
    expect(jp.count).toBe(60_000);
    expect(jp.paths[0]).toBe("$['orders'][1]['id']");
    const out = runJq(jq, text, "[.orders[] | select(.country == \"DE\")] | length", { compact: true, raw: false });
    expect(out.output).toBe("60000");
  }, 60_000);
});
