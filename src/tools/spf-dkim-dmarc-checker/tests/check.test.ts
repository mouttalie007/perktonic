import { describe, expect, it } from "vitest";
import { run } from "../src/logic/check";
import { checkDmarc, parseDkim, parsePolicy, rsaKeyBits } from "../src/logic/records";
import { Resolver } from "../src/logic/resolver";
import { checkSpf, parseTerms, syntaxProblems } from "../src/logic/spf";
import { mockFetcher } from "../fixtures/fetch";
import { mockDns } from "../fixtures/mockDns";
import { KEY_1024, KEY_2048, KEY_512, ZONES } from "../fixtures/zones";

const now = () => new Date("2026-11-01T12:00:00Z");
const deps = () => {
  const d = mockDns(ZONES);
  return { dns: d.dns, calls: d.calls, fetcher: mockFetcher().fetcher, now };
};
const levels = (checks: { level: string; message: string }[], level: string) => checks.filter((c) => c.level === level).map((c) => c.message);

describe("SPF", () => {
  it("counts DNS lookups recursively through includes and checks the all qualifier", async () => {
    const r = await run({ domain: "example.com" }, deps());
    // 2 includes + 2 nested includes + a: in the newsletter record = 5.
    expect(r.spf.lookups).toBe(5);
    expect(r.spf.voidLookups).toBe(0);
    expect(r.spf.all).toBe("~all");
    expect(r.spf.tree?.children.map((c) => [c.domain, c.lookups])).toEqual([
      ["_spf.mail-host.example", 2],
      ["servers.newsletter.example", 1],
    ]);
    expect(levels(r.spf.checks, "good")).toContain("5 of 10 DNS lookups used.");
    expect(r.spf.suggestion).toBeNull();
  });

  it("fails more than 10 lookups and flags the deprecated ptr", async () => {
    const r = await run({ domain: "toomany.example.com" }, deps());
    // 3 includes + 5 nested includes + mx + a + ptr = 11.
    expect(r.spf.lookups).toBe(11);
    expect(levels(r.spf.checks, "error")[0]).toMatch(/^11 DNS lookups .* The limit is 10/);
    expect(levels(r.spf.checks, "warning").some((m) => m.startsWith("The ptr mechanism is deprecated"))).toBe(true);
    expect(r.spf.suggestion).toBe("v=spf1 include:a.senders.example include:b.senders.example include:c.senders.example mx a ~all");
  });

  it("detects include loops, multiple records, +all, syntax errors and void lookups", async () => {
    const loop = await run({ domain: "loop.example.com" }, deps());
    expect(levels(loop.spf.checks, "error")).toContain("Loop: spf.loop-b.example includes spf.loop-a.example, which is already being evaluated.");
    const multi = await run({ domain: "multi.example.com" }, deps());
    const errors = levels(multi.spf.checks, "error");
    expect(errors[0]).toMatch(/^There are 2 SPF records/);
    expect(errors).toContain("“ip4:192.0.2.0/33” is not a valid IPv4 address or range.");
    expect(errors).toContain("+all lets every server in the world send as this domain. Use ~all or -all.");
    expect(multi.spf.suggestion).toBe("v=spf1 include:_spf.mail-host.example ~all");
    const voids = await run({ domain: "voids.example.com" }, deps());
    // gone1, gone2 and gone3 do not exist; nospf has TXT records (just no SPF), so it is not a void lookup.
    expect(voids.spf.voidLookups).toBe(3);
    expect(levels(voids.spf.checks, "error")).toEqual(expect.arrayContaining([expect.stringMatching(/^include:nospf.voids.example points to a domain without an SPF record/), expect.stringMatching(/^3 lookups returned nothing/)]));
    expect(levels(voids.spf.checks, "warning")[0]).toMatch(/^\?all \(neutral\)/);
    expect(syntaxProblems(parseTerms("v=spf1 -all include:x.example"))).toEqual(["Mechanisms after “all” are never used: “all” matches every sender."]);
  });

  it("never makes more than 40 DNS queries, even when probing selectors on a deep SPF tree", async () => {
    const d = deps();
    const r = await run({ domain: "toomany.example.com" }, d);
    expect(d.calls.length).toBeLessThanOrEqual(40);
    expect(r.queries).toBe(d.calls.length);
    const res = new Resolver(mockDns(ZONES).dns, 3);
    const tight = await checkSpf("toomany.example.com", res, 0);
    expect(levels(tight.checks, "info")[0]).toMatch(/^Some nested records were not followed/);
  });
});

describe("DMARC", () => {
  it("validates p, sp, pct, rua, adkim and aspf, warns about weak policies and suggests a stronger record", async () => {
    const r = await run({ domain: "example.com" }, deps());
    expect(r.dmarc.tags).toMatchObject({ v: "DMARC1", p: "none", pct: "50", adkim: "r", aspf: "r" });
    expect(levels(r.dmarc.checks, "warning")).toEqual([expect.stringMatching(/^p=none only monitors/), expect.stringMatching(/^pct=50/)]);
    expect(levels(r.dmarc.checks, "info")[0]).toContain("dmarc-vendor.example");
    expect(r.dmarc.suggestion).toBe("v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com,mailto:reports@dmarc-vendor.example; adkim=r; aspf=r");
    const bad = await checkDmarc("bad.example", new Resolver(mockDns({ "_dmarc.bad.example": { TXT: [["v=DMARC1; p=block; pct=150; rua=dmarc@bad.example; adkim=x", 60]] } }).dns, 5));
    expect(levels(bad.checks, "error")).toEqual(["p=block is not valid; use none, quarantine or reject.", "pct=150 must be a whole number from 0 to 100.", "rua=dmarc@bad.example is not a valid mailto: address.", "adkim=x must be r (relaxed) or s (strict)."]);
  });

  it("falls back to the organisational domain, and reports a missing record with a starter suggestion", async () => {
    const sub = await run({ domain: "toomany.example.com" }, deps());
    expect(sub.dmarc.foundAt).toBe("_dmarc.example.com");
    const bare = await run({ domain: "bare.example.org" }, deps());
    expect(bare.spf.checks[0].level).toBe("error");
    expect(bare.spf.suggestion).toBe("v=spf1 mx ~all");
    expect(bare.dmarc.record).toBeNull();
    expect(bare.dmarc.suggestion).toBe("v=DMARC1; p=none; rua=mailto:dmarc-reports@example.org");
  });
});

describe("DKIM, MTA-STS and BIMI", () => {
  it("reads key sizes from real keys, follows CNAMEs, and probes common selectors honestly", async () => {
    expect([rsaKeyBits(KEY_2048), rsaKeyBits(KEY_1024), rsaKeyBits(KEY_512)]).toEqual([2048, 1024, 512]);
    const r = await run({ domain: "example.com" }, deps());
    expect(r.dkim.mode).toBe("probe");
    expect(r.dkim.found.map((k) => [k.selector, k.keyBits, k.testing])).toEqual([
      ["google", 2048, false],
      ["selector1", 1024, true],
    ]);
    const none = await run({ domain: "bare.example.org" }, deps());
    expect(none.dkim.checks[0].message).toMatch(/^None of 20 common selectors has a DKIM key. That does not prove DKIM is missing/);
    const given = await run({ domain: "example.com", selector: "s2024" }, deps());
    expect(given.dkim.checks[0]).toEqual({ level: "error", message: "Selector not found: there is no DKIM record at s2024._domainkey.example.com. Check the selector in the DKIM-Signature header (s=) of a message you sent." });
    expect(parseDkim("x", `v=DKIM1; p=`)).toMatchObject({ revoked: true, keyBits: null });
    expect(parseDkim("x", `v=DKIM1; k=ed25519; p=11qYAYKxCrfVS/7TyWQHOg7hcvPapiMlrwIaaPcHURo=`)).toMatchObject({ keyType: "ed25519", keyBits: 256 });
  });

  it("fetches the MTA-STS policy through safeFetch, checks it against the MX hosts, and checks BIMI syntax", async () => {
    const d = deps();
    const f = mockFetcher();
    const r = await run({ domain: "example.com" }, { ...d, fetcher: f.fetcher });
    expect(f.calls.map((c) => c.url)).toEqual(["https://mta-sts.example.com/.well-known/mta-sts.txt"]);
    expect(r.mtaSts.policy).toEqual({ version: "STSv1", mode: "testing", mx: ["aspmx.mail-host.example"], maxAge: 86400 });
    expect(levels(r.mtaSts.checks, "error")).toEqual(["MX host(s) not covered by the policy: alt1.mail-host.example. In enforce mode, senders will refuse to deliver to them."]);
    expect(levels(r.bimi.checks, "warning")).toEqual(["BIMI needs DMARC with p=quarantine or p=reject; with the current DMARC policy the logo is not shown."]);
    expect(parsePolicy("version: STSv1\nmode: enforce\nmx: *.mail.example\nmx: mx1.example\nmax_age: 604800")).toEqual({ version: "STSv1", mode: "enforce", mx: ["*.mail.example", "mx1.example"], maxAge: 604800 });
    const redirected = await run({ domain: "example.com" }, { ...d, fetcher: mockFetcher({ "https://mta-sts.example.com/.well-known/mta-sts.txt": { status: 301, headers: { location: "https://example.com/" } } }).fetcher });
    expect(levels(redirected.mtaSts.checks, "error")[0]).toMatch(/^The policy URL redirects/);
  });

  it("validates input and answers with the contract", async () => {
    const { POST } = await import("../src/api/route");
    const post = (body: unknown) => POST(new Request("http://localhost/api/tools/spf-dkim-dmarc-checker", { method: "POST", body: JSON.stringify(body) }));
    const ip = await post({ domain: "192.0.2.1" });
    expect(ip.status).toBe(400);
    const sel = await post({ domain: "example.com", selector: "bad selector!" });
    expect((await sel.json()).error.message).toMatch(/^A DKIM selector is a short name/);
  });
});
