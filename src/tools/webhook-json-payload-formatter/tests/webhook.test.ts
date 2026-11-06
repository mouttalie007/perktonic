import { describe, expect, it } from "vitest";
import { formatJson, pathString, treeChildren } from "../src/logic/format";
import { JsonSyntaxError, locate, parseJson } from "../src/logic/parser";
import { keyFields, leafPathsCsv, parsePath } from "../src/logic/paths";
import { detect, inspect } from "../src/logic/providers";
import { luhn, maskString, maskTree, type MaskCounts } from "../src/logic/redact";
import { BROKEN, SAMPLES } from "../fixtures/samples";

const parse = (s: string) => parseJson(s, { lenient: false }).root;
const zero = (): MaskCounts => ({ tokens: 0, emails: 0, cards: 0 });

describe("parsing, errors and paths", () => {
  it("reports the line and column of invalid JSON", () => {
    let err: unknown;
    try {
      parse(BROKEN);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(JsonSyntaxError);
    const at = locate(BROKEN, (err as JsonSyntaxError).offset);
    expect(at.line).toBe(6);
    expect(at.lineText).toContain('"amount_paid": 4900, }');
  });

  it("gives copyable paths such as $.data.object.id, and reads them back", () => {
    const root = parse(SAMPLES.stripe);
    const data = treeChildren(root, [], []).children.find((c) => c.key === "data")!;
    const object = treeChildren(root, data.positions, ["data"]).children[0];
    const id = treeChildren(root, object.positions, ["data", "object"]).children.find((c) => c.key === "id")!;
    expect(id.path).toBe("$.data.object.id");
    expect(pathString(["line_items", 0, "odd key"])).toBe("$.line_items[0]['odd key']");
    expect(parsePath("$.line_items[0]['odd key']")).toEqual(["line_items", 0, "odd key"]);
    expect(keyFields(root, ["$.data.object.id", "$.not.there"])).toEqual([{ path: "$.data.object.id", type: "string", summary: '"pi_3QK8m2LkdIwHu7ix0b9XyZ12"' }]);
    const csv = leafPathsCsv(root).csv;
    expect(csv.startsWith("﻿path,type,value\r\n$.id,string,evt_")).toBe(true);
    expect(csv).toContain("$.data.object.payment_method_types[0],string,card");
  });

  it("handles a 5 MB payload: parse, mask, check, format and list paths", () => {
    const event = JSON.parse(SAMPLES.stripe);
    const list = { object: "list", data: [] as unknown[], has_more: false };
    const itemSize = JSON.stringify(event.data.object).length;
    while (list.data.length * itemSize < 5 * 1024 * 1024) list.data.push({ ...event.data.object, id: `pi_${list.data.length}` });
    const text = JSON.stringify({ ...event, data: { object: list } });
    const root = parse(text);
    const { root: masked, counts } = maskTree(root);
    expect(counts.emails).toBe(list.data.length);
    expect(inspect(root, "auto").provider).toBe("stripe");
    expect(formatJson(masked, { indent: 2, sortKeys: false }).length).toBeGreaterThan(text.length);
    const paths = leafPathsCsv(masked);
    expect(paths.rows).toBeGreaterThan(100_000);
  }, 30_000);
});

describe("masking secrets", () => {
  it("masks provider tokens and secret-named fields, keeping a short prefix", () => {
    const c = zero();
    expect(maskString("key sk_live_51Hx9aBcDeFgHiJkLmN and whsec_abcdef123456", null, c)).toBe("key sk_live_…[redacted] and whsec_…[redacted]");
    expect(maskString("ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789", null, c)).toBe("ghp_…[redacted]");
    expect(maskString("xoxb-1234567890-abcdefghij", null, c)).toBe("xoxb-…[redacted]");
    expect(maskString("Authorization: Bearer abc.def.ghi-123", null, c)).toBe("Authorization: Bearer [redacted]");
    expect(maskString("https://hooks.slack.com/services/T000/B000/XXXX", null, c)).toBe("https://hooks.slack.com/…[redacted]");
    expect(maskString("shpat" + "_0123456789abcdef0123456789abcdef", null, c)).toBe("shpat_…[redacted]");
    expect(maskString("anything at all", "client_secret", c)).toBe("[redacted]");
    expect(maskString("Jhj5dZrVaK7ZwHHjRyZWjbDl", "token", c)).toBe("[redacted]");
    expect(maskString("Ada Lovelace", "author", c)).toBe("Ada Lovelace");
    expect(c.tokens).toBe(9);
  });

  it("masks emails and Luhn-valid card-like numbers only", () => {
    const c = zero();
    expect(maskString("Contact ada.lovelace+billing@example.co.uk", null, c)).toBe("Contact ***@example.co.uk");
    expect(maskString("card 4242 4242 4242 4242 order 1234567890123", null, c)).toBe("card **** **** **** 4242 order 1234567890123");
    expect(luhn("4000056655665556")).toBe(true);
    expect(c).toEqual({ tokens: 0, emails: 1, cards: 1 });
    const { root, counts } = maskTree(parse('{"pan": 4000056655665556, "n": 1234567890123, "id": 42}'));
    expect(formatJson(root, { indent: null, sortKeys: false })).toBe('{"pan":"************5556","n":1234567890123,"id":42}');
    expect(counts.cards).toBe(1);
  });

  it("leaves the original tree untouched, and the samples mask what they should", () => {
    const root = parse(SAMPLES.slack);
    const { root: masked, counts } = maskTree(root);
    expect(formatJson(root, { indent: null, sortKeys: false })).toContain("Jhj5dZrVaK7ZwHHjRyZWjbDl");
    expect(formatJson(masked, { indent: null, sortKeys: false })).toContain('"token":"[redacted]"');
    expect(counts.tokens).toBe(1);
    const stripe = maskTree(parse(SAMPLES.stripe));
    expect(stripe.counts).toEqual({ tokens: 1, emails: 1, cards: 0 });
  });
});

describe("advisory provider checks", () => {
  it("detects each provider from its sample and passes every check on it", () => {
    for (const id of ["stripe", "github", "shopify", "slack"] as const) {
      const root = parse(SAMPLES[id]);
      expect(detect(root)).toBe(id);
      const res = inspect(root, "auto");
      const warns = res.checks.filter((c) => c.level === "warn").map((c) => c.title);
      // Slack's sample deliberately keeps the deprecated verification token.
      expect(warns).toEqual(id === "slack" ? ["$.token is the deprecated verification token"] : []);
      expect(res.checks.filter((c) => c.level === "pass").length).toBeGreaterThan(5);
    }
    expect(inspect(parse(SAMPLES.github), "auto").event).toBe("pull_request (opened)");
    expect(inspect(parse(SAMPLES.stripe), "auto").event).toBe("payment_intent.succeeded (pi_3QK8m2LkdIwHu7ix0b9XyZ12)");
    expect(inspect(parse(SAMPLES.slack), "auto").event).toBe("event_callback → app_mention");
  });

  it("flags malformed and missing fields, naming the documentation page", () => {
    const stripe = JSON.parse(SAMPLES.stripe);
    stripe.created = 1761990410000;
    stripe.data.object.amount = "49.00";
    delete stripe.pending_webhooks;
    const res = inspect(parse(JSON.stringify(stripe)), "auto");
    const warns = res.checks.filter((c) => c.level === "warn");
    expect(warns.map((c) => c.path)).toEqual(["$.created", "$.pending_webhooks", "$.data.object.amount"]);
    expect(warns[0].detail).toBe("Found 1761990410000 (an integer).");
    expect(warns[1].detail).toBe("Not found in this payload.");
    expect(warns[2].doc.url).toBe("https://docs.stripe.com/api/events/object");

    const shop = JSON.parse(SAMPLES.shopify);
    shop.total_price = 94.9;
    shop.admin_graphql_api_id = "gid://shopify/Order/1";
    const s = inspect(parse(JSON.stringify(shop)), "auto").checks.filter((c) => c.level === "warn");
    expect(s.map((c) => c.path)).toEqual(["$.admin_graphql_api_id", "$.total_price"]);
  });

  it("checks GitHub push payloads and Slack URL verification", () => {
    const push = {
      ref: "refs/heads/main",
      before: "1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d",
      after: "not-a-sha",
      commits: [{ id: "9f3c2a1b7e6d5c4b3a291807f6e5d4c3b2a19081", message: "Fix", author: { email: "a@example.com" } }],
      head_commit: null,
      repository: { id: 1, full_name: "octo/app", owner: { login: "octo" } },
      sender: { login: "octo", id: 2 },
    };
    const g = inspect(parse(JSON.stringify(push)), "auto");
    expect(g.event).toBe("push");
    expect(g.checks.filter((c) => c.level === "warn").map((c) => c.path)).toEqual(["$.after"]);
    const v = inspect(parse('{"token":"x","challenge":"3eZbrw1aBm2rZgRNFdxV2595E9CY3gmdALWMmHkvFXO7tYXAYM8P","type":"url_verification"}'), "auto");
    expect(v.provider).toBe("slack");
    expect(v.checks.some((c) => c.title === "Reply with the challenge")).toBe(true);
  });

  it("keeps every check advisory and sourced, and supports manual or no provider", () => {
    for (const id of ["stripe", "github", "shopify", "slack"] as const) {
      for (const c of inspect(parse(SAMPLES[id]), "auto").checks) {
        expect(["pass", "warn", "info"]).toContain(c.level);
        expect(c.doc.url).toMatch(/^https:\/\/(docs\.stripe\.com|docs\.github\.com|shopify\.dev|docs\.slack\.dev)\//);
        expect(c.doc.title.length).toBeGreaterThan(10);
      }
    }
    const plain = parse('{"hello": "world"}');
    expect(inspect(plain, "auto")).toMatchObject({ provider: null, checks: [] });
    expect(inspect(plain, "stripe").checks.filter((c) => c.level === "warn").length).toBeGreaterThan(5);
    expect(inspect(parse(SAMPLES.stripe), "none").checks).toEqual([]);
  });
});
