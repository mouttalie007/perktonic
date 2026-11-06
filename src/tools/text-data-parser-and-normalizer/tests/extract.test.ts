import { Worker } from "node:worker_threads";
import { describe, expect, it } from "vitest";
import { entitiesCsv, entitiesJson } from "../src/logic/export";
import { amounts, compressIPv6, customMatches, dates, emails, extractAll, ibanValid, ips, parseAmount, phones, urls } from "../src/logic/extract";
import { CUSTOM_TIMEOUT_MS } from "../src/logic/types";
import { SAMPLE } from "../fixtures/sample";

const values = (h: { value: string }[]) => h.map((x) => x.value);
const norm = (h: { normalized: string }[]) => h.map((x) => x.normalized);

describe("emails and URLs", () => {
  it("finds plus-addressed and Unicode-domain emails and lower-cases the domain", () => {
    const e = emails("Write to Ada.Lovelace+billing@Example.CO.uk, josé@correo.españa.es or 用户@例子.广告; not a@b or x@@y.com.");
    expect(values(e)).toEqual(["Ada.Lovelace+billing@Example.CO.uk", "josé@correo.españa.es", "用户@例子.广告"]);
    expect(e[0]).toMatchObject({ normalized: "Ada.Lovelace+billing@example.co.uk", extra: "base address Ada.Lovelace@example.co.uk" });
  });

  it("finds URLs with and without a scheme and trims trailing punctuation", () => {
    const u = urls("See https://en.wikipedia.org/wiki/Regex_(disambiguation), www.example.com/help. Also example.org/docs?x=1 and (https://status.example.com). Not file.txt or v1.2.");
    expect(norm(u)).toEqual(["https://en.wikipedia.org/wiki/Regex_(disambiguation)", "https://www.example.com/help", "https://example.org/docs?x=1", "https://status.example.com"]);
  });
});

describe("phones, dates and amounts", () => {
  it("reads phone numbers in several formats into E.164 using the default country", () => {
    // With the US as default country, a UK number without +44 (020 7946 0958) is not a possible number and is skipped.
    const p = phones("Call +44 20 7946 0958, 020 7946 0958, 0044 20 7946 0958, +1 (212) 555-0147, 212.555.0147 or (212) 555 0147 ext. 12.", "US");
    expect(norm(p)).toEqual(["+442079460958", "+442079460958", "+12125550147", "+12125550147", "+12125550147"]);
    expect(norm(phones("Call 020 7946 0958", "GB"))).toEqual(["+442079460958"]);
    expect(norm(phones("Tel. 01 42 68 53 00 / +33 1 42 68 53 00", "FR"))).toEqual(["+33142685300", "+33142685300"]);
  });

  it("normalizes dates to ISO and respects the day/month choice for ambiguous dates", () => {
    const t = "Due 03/04/2026, paid 2026-04-03T10:00Z, shipped 15.04.26, 4th April 2026, April 4, 2026; not 2026-02-30 or 31/04/2026.";
    expect(norm(dates(t, true))).toEqual(["2026-04-03", "2026-04-03T10:00Z", "2026-04-15", "2026-04-04", "2026-04-04"]);
    expect(dates(t, false)[0]).toMatchObject({ normalized: "2026-03-04", extra: "read as month/day" });
  });

  it("reads currency amounts with symbols or codes, before or after, in both number styles", () => {
    expect(norm(amounts("Total €1.234,56, $1,342.10, GBP 1,078.00, 12,50 €, 500 CHF, US$ 99, ¥12,000, -$5.00, $2.5m and 3 apples."))).toEqual([
      "EUR 1234.56", "USD 1342.10", "GBP 1078.00", "EUR 12.50", "CHF 500.00", "USD 99.00", "JPY 12000", "USD -5.00", "USD 2500000.00",
    ]);
    expect([parseAmount("1 234,5"), parseAmount("1,234"), parseAmount("12.345.678,90")]).toEqual([1234.5, 1234, 12345678.9]);
  });
});

describe("IPs and IBANs", () => {
  it("validates IPv4 and IPv6 and checks IBAN checksums", () => {
    const r = ips("Hosts 10.0.0.1, 256.1.1.1, 1.2.3, 2001:0DB8:0000:0000:0000:ff00:0042:8329, ::1, fe80::1 and the time 10:30:00.");
    expect(values(r.v4)).toEqual(["10.0.0.1"]);
    expect(norm(r.v6)).toEqual(["2001:db8::ff00:42:8329", "::1", "fe80::1"]);
    expect(compressIPv6("2001:db8:0:0:1:0:0:1")).toBe("2001:db8::1:0:0:1");
    expect(ibanValid("GB82 WEST 1234 5698 7654 32")).toBe(true);
    expect(ibanValid("GB82 WEST 1234 5698 7654 33")).toBe(false);
    expect(ibanValid("DE89 3704 0044 0532 0130 00")).toBe(true);
  });
});

describe("the whole sample", () => {
  it("extracts every category, de-duplicating case-insensitively where it should", () => {
    const r = extractAll(SAMPLE, { country: "GB", dayFirst: true, dedupe: true });
    expect(r.email.map((e) => [e.normalized, e.count])).toEqual([["ada.lovelace+billing@example.co.uk", 2], ["Support@example.co.uk", 1], ["josé@correo.españa.es", 1]]);
    expect(r.hashtag.map((e) => [e.value, e.count])).toEqual([["#Refunds", 2], ["#Q4", 1]]);
    expect(r.mention.map((e) => [e.value, e.count])).toEqual([["@ada_support", 2]]);
    expect(norm(r.phone)).toEqual(["+442079460958", "+447812345678", "+12125550147"]);
    expect(norm(r.date)).toEqual(["2026-10-28", "2026-03-03", "2026-03-05", "2026-10-12"]);
    expect(norm(r.amount)).toEqual(["EUR 1234.56", "USD 1342.10", "GBP 1078.00"]);
    expect(r.iban.map((e) => e.note)).toEqual(["checksum valid", "checksum NOT valid (typo or not an IBAN)"]);
    expect(norm(r.ipv6)).toEqual(["2001:db8::ff00:42:8329"]);
    // No phone number is read out of dates, IPs or IBANs.
    expect(r.phone).toHaveLength(3);
    const all = extractAll(SAMPLE, { country: "GB", dayFirst: true, dedupe: false });
    expect(all.hashtag).toHaveLength(3);
  });

  it("handles 5 MB of text", () => {
    const big = SAMPLE.repeat(Math.ceil((5 * 1024 * 1024) / SAMPLE.length));
    const r = extractAll(big, { country: "GB", dayFirst: true, dedupe: true });
    expect(r.email[0].count).toBeGreaterThan(5000);
    expect(r.phone).toHaveLength(3);
  }, 60_000);
});

describe("custom pattern and export", () => {
  it("runs a custom pattern with de-duplication and stops a runaway one with a worker timeout", async () => {
    expect(customMatches("Order A-1042, a-1042 and B-77", String.raw`[A-Z]-\d+`, "gi", true, true).map((e) => [e.value, e.count])).toEqual([["A-1042", 2], ["B-77", 1]]);
    const w = new Worker(new URL("./slow-worker.mjs", import.meta.url), { workerData: { pattern: "^(a+)+$", flags: "", text: `${"a".repeat(40)}!` } });
    const outcome = await new Promise<string>((resolve) => {
      const t = setTimeout(() => {
        void w.terminate();
        resolve("stopped");
      }, CUSTOM_TIMEOUT_MS);
      w.on("message", () => {
        clearTimeout(t);
        resolve("finished");
      });
    });
    expect(outcome).toBe("stopped");
  }, 10_000);

  it("exports each category to CSV and JSON", () => {
    const r = extractAll("Mail -cmd@evil.com and bob@example.com, bob@EXAMPLE.com", { country: "US", dayFirst: true, dedupe: true });
    const csv = entitiesCsv(r.email);
    expect(csv.split("\r\n")[0]).toBe("﻿value,normalized,count,first_position,note,context");
    expect(csv).toContain("'-cmd@evil.com");
    expect(JSON.parse(entitiesJson("email", r.email))).toMatchObject({ category: "email", count: 2, items: [{ value: "-cmd@evil.com" }, { normalized: "bob@example.com", count: 2 }] });
  });

  it("copes with hundreds of thousands of hits in one category (no call-stack overflow)", () => {
    const text = "https://shop.example.com/p/1 €2,50 ".repeat(150_000);
    const r = extractAll(text, { country: "GB", dayFirst: true, dedupe: false }, () => {});
    expect(r.url.length).toBe(150_000);
    expect(r.amount.length).toBe(150_000);
  }, 30_000);
});
