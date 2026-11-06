import { describe, expect, it } from "vitest";
import { DnsQueryError, normalizeDnsName, parseDohResponse } from "./dns-query";
import { normalizeHost, tlsInspect, TlsInspectError } from "./tls-inspect";

const code = (fn: () => unknown) => {
  try {
    fn();
    return "ok";
  } catch (e) {
    return (e as { code: string }).code;
  }
};

describe("normalizeDnsName", () => {
  it("lower-cases, strips the trailing dot and converts IDN to punycode", () => {
    expect(normalizeDnsName(" Example.COM. ")).toBe("example.com");
    expect(normalizeDnsName("bücher.example")).toBe("xn--bcher-kva.example");
    expect(normalizeDnsName("selector1._domainkey.example.com")).toBe("selector1._domainkey.example.com");
  });
  it.each(["", "localhost", "a", "10.0.0.1", "::1", "-bad.com", "has space.com", "x.local", "foo.internal", "a".repeat(64) + ".com"])("rejects %j", (n) => {
    expect(code(() => normalizeDnsName(n))).toBe("invalid_name");
  });
});

describe("parseDohResponse", () => {
  it("reads MX, joins TXT chunks and keeps the CNAME chain in order", () => {
    const mx = parseDohResponse("example.com", "MX", { Status: 0, AD: true, Answer: [{ name: "example.com.", type: 15, TTL: 300, data: "10 mail.example.com." }] });
    expect(mx).toMatchObject({ status: "ok", dnssec: true, records: [{ type: "MX", ttl: 300, data: "10 mail.example.com" }] });
    const txt = parseDohResponse("example.com", "TXT", { Status: 0, Answer: [{ name: "example.com.", type: 16, TTL: 60, data: '"v=spf1 include:a.example " "-all"' }] });
    expect(txt.records[0]!.data).toBe("v=spf1 include:a.example -all");
    const chain = parseDohResponse("www.example.com", "A", {
      Status: 0,
      Answer: [
        { name: "www.example.com.", type: 5, TTL: 120, data: "edge.cdn.example." },
        { name: "edge.cdn.example.", type: 1, TTL: 30, data: "93.184.216.34" },
      ],
    });
    expect(chain.records.map((r) => r.type)).toEqual(["CNAME", "A"]);
  });
  it("distinguishes NXDOMAIN, no data and server failure", () => {
    expect(parseDohResponse("x.example.com", "A", { Status: 3 }).status).toBe("nxdomain");
    expect(parseDohResponse("x.example.com", "MX", { Status: 0 }).status).toBe("nodata");
    expect(parseDohResponse("x.example.com", "A", { Status: 2 }).status).toBe("servfail");
  });
  it("decodes CAA sent in the generic RFC 3597 form", () => {
    const hex = "000569737375656c657473656e63727970742e6f7267"; // flags 0, tag "issue", value "letsencrypt.org"
    const r = parseDohResponse("example.com", "CAA", { Status: 0, Answer: [{ name: "example.com.", type: 257, TTL: 3600, data: String.raw`\# 22 ` + hex }] });
    expect(r.records[0]!.data).toBe('0 issue "letsencrypt.org"');
  });
  it("rejects a body that is not a DNS answer", () => {
    expect(() => parseDohResponse("example.com", "A", { nope: 1 })).toThrow(DnsQueryError);
  });
});

describe("tls-inspect address policy", () => {
  it.each(["localhost", "127.0.0.1", "10.0.0.5", "169.254.169.254", "intranet.local"])("refuses %s before connecting", async (h) => {
    await expect(tlsInspect(h)).rejects.toMatchObject({ code: "blocked_host" });
  });
  it("refuses ports outside the allow-list and invalid names", async () => {
    await expect(tlsInspect("example.com", { port: 22 })).rejects.toBeInstanceOf(TlsInspectError);
    expect(code(() => normalizeHost("not a host"))).toBe("invalid_host");
  });
});
