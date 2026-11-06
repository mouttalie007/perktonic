import { beforeEach, describe, expect, it } from "vitest";
import { DataSchema } from "../src/api/schema";
import { normalizeDomain, registeredDomain, toUnicode } from "../src/logic/domain";
import { run } from "../src/logic/lookup";
import { clearBootstrapCache, lookupRegistration, parseBootstrap } from "../src/logic/rdap";
import { mockDns } from "../fixtures/mockDns";
import { BOOTSTRAP, mockFetcher, RDAP_TABLE } from "../fixtures/rdap";
import { DNSSEC_SIGNED, ZONES } from "../fixtures/zones";

const now = () => new Date("2026-11-01T12:00:00Z");
const deps = (opts: Parameters<typeof mockDns>[1] = { dnssec: DNSSEC_SIGNED }) => {
  const d = mockDns(ZONES, opts);
  const f = mockFetcher(RDAP_TABLE);
  return { dns: d.dns, calls: d.calls, fetcher: f.fetcher, http: f.calls, now };
};
const codes = (r: { findings: { code: string }[] }) => r.findings.map((f) => f.code);

beforeEach(() => clearBootstrapCache());

describe("input", () => {
  it("accepts domains, URLs and emails, converts IDN to punycode and refuses IP addresses", () => {
    expect(normalizeDomain("Example.NET.")).toEqual({ ok: true, domain: "example.net", unicode: null });
    expect(normalizeDomain("https://www.example.net/pricing?x=1")).toMatchObject({ domain: "www.example.net" });
    expect(normalizeDomain("ada@example.net")).toMatchObject({ domain: "example.net" });
    expect(normalizeDomain("bücher.example")).toEqual({ ok: true, domain: "xn--bcher-kva.example", unicode: "bücher.example" });
    expect(normalizeDomain("_dmarc.example.net")).toMatchObject({ ok: true, domain: "_dmarc.example.net" });
    expect(normalizeDomain("203.0.113.5")).toMatchObject({ ok: false, error: expect.stringContaining("IP address") });
    expect(normalizeDomain("[2001:db8::1]")).toMatchObject({ ok: false, error: expect.stringContaining("IP address") });
    expect(normalizeDomain("localhost")).toMatchObject({ ok: false });
    expect(normalizeDomain("printer.local")).toMatchObject({ ok: false, error: expect.stringContaining("private") });
    expect(normalizeDomain("exa mple.com")).toMatchObject({ ok: false });
    expect(toUnicode("xn--mnchen-3ya.de")).toBe("münchen.de");
    expect([registeredDomain("www.shop.example.co.uk"), registeredDomain("mail.example.net")]).toEqual(["example.co.uk", "example.net"]);
  });
});

describe("records and warnings", () => {
  it("returns all eight types with TTLs, reads the CNAME chain from the A answer and stays within 8 queries", async () => {
    const d = deps();
    const r = await run({ domain: "example.net" }, d);
    expect(r.results.map((x) => [x.type, x.status, x.records.length])).toEqual([
      ["A", "ok", 1],
      ["AAAA", "nodata", 0],
      ["CNAME", "nodata", 0],
      ["MX", "ok", 2],
      ["TXT", "ok", 3],
      ["NS", "ok", 2],
      ["SOA", "ok", 1],
      ["CAA", "ok", 2],
    ]);
    expect(r.results[3].records[0]).toEqual({ name: "example.net", type: "MX", ttl: 3600, data: "10 mx1.example.net" });
    expect(r.results[0].dnssec).toBe(true);
    // 7 record queries (CNAME comes from the A answer) + 1 MX host check = 8.
    expect(d.calls).toHaveLength(8);
    expect(r.queries).toBe(8);
    expect(DataSchema.parse(r)).toBeTruthy();
  });

  it("warns about an MX that points to a CNAME, long TXT strings, low TTLs and missing AAAA", async () => {
    const r = await run({ domain: "example.net" }, deps());
    expect(codes(r)).toEqual(["mx_cname", "mx_partly_checked", "no_aaaa", "low_ttl", "long_txt"]);
    expect(r.findings[0].message).toContain("mx1.example.net is a CNAME");
    const txt = r.results.find((x) => x.type === "TXT")!.records[1].data;
    expect(txt.length).toBeGreaterThan(400);
  });

  it("shows the CNAME chain in order and detects a dangling CNAME", async () => {
    const www = await run({ domain: "www.example.net", whois: false }, deps());
    expect(www.chain.map((c) => `${c.name} → ${c.data}`)).toEqual(["www.example.net → example-net.cdn-host.example", "example-net.cdn-host.example → edge-17.cdn-host.example"]);
    expect(www.results.find((x) => x.type === "A")!.records.map((a) => a.data)).toEqual(["203.0.113.10", "203.0.113.11"]);
    expect(www.results.find((x) => x.type === "CNAME")!.status).toBe("ok");
    const old = await run({ domain: "old.example.net", whois: false }, deps());
    expect(codes(old)).toContain("dangling_cname");
    expect(old.findings.find((f) => f.code === "dangling_cname")!.message).toContain("retired-app.paas-host.example, which does not exist");
  });

  it("warns about no MX, a single name server and very high TTLs", async () => {
    const r = await run({ domain: "example.org" }, deps());
    expect(codes(r)).toEqual(expect.arrayContaining(["no_mx", "single_ns", "high_ttl", "no_caa"]));
    expect(r.registration).toMatchObject({ status: "not_found" });
  });

  it("reports a name that does not exist, and keeps going when one record type fails", async () => {
    const nx = await run({ domain: "nothing-here.example.net", whois: false }, deps());
    expect(codes(nx)[0]).toBe("nxdomain");
    const partial = await run({ domain: "example.net", whois: false }, deps({ failTypes: ["CAA"] }));
    expect(partial.results.find((x) => x.type === "CAA")!.status).toBe("error");
    expect(codes(partial)).toContain("partial");
    await expect(run({ domain: "example.net" }, { ...deps({ failTypes: ["A", "AAAA", "MX", "TXT", "NS", "SOA", "CAA"] }) })).rejects.toMatchObject({ code: "upstream" });
  });
});

describe("registration data (RDAP)", () => {
  it("reads registrar, dates, statuses and name servers, never contact data, with the bootstrap cached for 24 hours", async () => {
    const f = mockFetcher(RDAP_TABLE);
    const reg = await lookupRegistration("example.net", f.fetcher, now().getTime());
    expect(reg).toEqual({
      status: "ok",
      message: null,
      server: "rdap.registry.example",
      domain: "example.net",
      registrar: "Example Registrar, Inc.",
      registrarIanaId: "9999",
      created: "1995-01-14T05:00:00Z",
      updated: "2026-01-16T18:26:50Z",
      expires: "2027-01-13T05:00:00Z",
      statuses: ["client delete prohibited", "client transfer prohibited", "client update prohibited"],
      nameservers: ["ns1.dns-host.example", "ns2.dns-host.example"],
      dnssecSigned: true,
    });
    expect(JSON.stringify(reg)).not.toContain("Jane");
    await lookupRegistration("example.net", f.fetcher, now().getTime() + 3600_000);
    await lookupRegistration("example.net", f.fetcher, now().getTime() + 25 * 3600_000);
    expect(f.calls.filter((u) => u.includes("iana")).length).toBe(2);
    expect(parseBootstrap(BOOTSTRAP).get("org")).toBe("https://rdap.org-registry.example/rdap/");
  });

  it("says plainly when a TLD has no RDAP server, and still returns the DNS records", async () => {
    const r = await run({ domain: "bücher.example" }, deps());
    expect(r.domain).toBe("xn--bcher-kva.example");
    expect(r.unicode).toBe("bücher.example");
    expect(r.registration).toMatchObject({ status: "no_rdap", message: expect.stringContaining("The .example registry has no RDAP server") });
    expect(r.results.find((x) => x.type === "A")!.records).toHaveLength(1);
    const down = await lookupRegistration("example.net", mockFetcher({}).fetcher, now().getTime());
    expect(down.status).toBe("error");
  });

  it("validates the request and answers with the contract before any lookup", async () => {
    const { POST } = await import("../src/api/route");
    const post = (body: string) => POST(new Request("http://localhost/api/tools/dns-lookup-tool", { method: "POST", body }));
    expect(await (await post("{")).json()).toEqual({ ok: false, error: { code: "invalid_input", message: "The request was not valid JSON." } });
    const ip = await post(JSON.stringify({ domain: "8.8.8.8" }));
    expect(ip.status).toBe(400);
    expect((await ip.json()).error.message).toContain("IP address");
    const badType = await post(JSON.stringify({ domain: "example.net", types: ["PTR"] }));
    expect(badType.status).toBe(400);
  });
});
