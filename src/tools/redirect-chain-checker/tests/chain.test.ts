import { afterEach, describe, expect, it, vi } from "vitest";
import { SafeFetchError } from "@/lib/tools/safe-fetch";
import { analyzeChain } from "../src/logic/analyze";
import { ChainError, run } from "../src/logic/chain";
import { findClientRedirects } from "../src/logic/clientRedirects";
import { reportCsv, reportText } from "../src/logic/report";
import { normalizeUrl } from "../src/logic/url";
import { USER_AGENTS } from "../src/logic/userAgents";
import { BROKEN_END, CLIENT_SIDE, DOWNGRADE, ELEVEN, EXAMPLE_URL, LOOP, MIXED, TWO_HOP } from "../fixtures/chains";
import { mockFetcher, type FakePage } from "../fixtures/mockFetcher";

const check = async (pages: Record<string, FakePage>, url: string, userAgent: keyof typeof USER_AGENTS = "default") => {
  const m = mockFetcher(pages);
  const result = await run({ url, userAgent }, { fetcher: m.fetcher });
  return { result, analysis: analyzeChain(result), calls: m.calls };
};
const codes = (a: { findings: { code: string }[] }) => a.findings.map((f) => f.code);

describe("following the chain", () => {
  it("shows every hop with status, target and time, and recommends collapsing to a single 301", async () => {
    const { result, analysis } = await check(TWO_HOP, EXAMPLE_URL);
    expect(result.hops.map((h) => [h.status, h.url, h.location])).toEqual([
      [301, "http://www.github.com/", "https://www.github.com/"],
      [301, "https://www.github.com/", "https://github.com/"],
      [200, "https://github.com/", null],
    ]);
    expect(result.hops.map((h) => h.ms)).toEqual([62, 118, 240]);
    expect(result.totalMs).toBe(420);
    expect(result.redirectCount).toBe(2);
    expect(codes(analysis)).toEqual(expect.arrayContaining(["chain", "split_canonical", "https_first"]));
    expect(analysis.recommendation).toBe("Collapse to a single 301: redirect http://www.github.com/ straight to https://github.com/.");
  });

  it("stops a redirect loop before requesting the same URL twice", async () => {
    const { result, analysis, calls } = await check(LOOP, "https://shop.example.com/sale");
    expect(calls.map((c) => c.url)).toEqual(["https://shop.example.com/sale", "https://shop.example.com/sale/"]);
    expect(result.stop?.reason).toBe("loop");
    expect(analysis.findings[0].code).toBe("loop");
    expect(analysis.recommendation).toMatch(/Fix the loop/);
  });

  it("stops after 10 redirects", async () => {
    const { result, analysis, calls } = await check(ELEVEN, "https://hops.example.com/0");
    expect(calls).toHaveLength(11);
    expect(result.redirectCount).toBe(11);
    expect(result.stop?.reason).toBe("too_many_redirects");
    expect(codes(analysis)).toContain("too_many");
  });

  it("resolves relative Location headers and notes them", async () => {
    const { result, analysis } = await check(ELEVEN, "https://hops.example.com/9");
    expect(result.hops[0].locationRaw).toBe("/10");
    expect(result.hops[0].location).toBe("https://hops.example.com/10");
    expect(result.hops[0].relativeLocation).toBe(true);
    expect(codes(analysis)).toContain("relative");
  });

  it("passes the chosen user agent to every request", async () => {
    const { calls } = await check(TWO_HOP, EXAMPLE_URL, "googlebot");
    expect(calls.every((c) => c.opts.userAgent?.includes("Googlebot"))).toBe(true);
    expect(calls.every((c) => c.opts.method === "GET" && c.opts.maxBytes === 256 * 1024)).toBe(true);
  });
});

describe("analysis", () => {
  it("flags mixed 301/302/307/308, temporary hops, late HTTPS and www flip-flops", async () => {
    const { analysis } = await check(MIXED, "http://example.org/old");
    expect(codes(analysis)).toEqual(expect.arrayContaining(["mixed", "temporary", "www_flipflop", "chain", "https_first"]));
    expect(analysis.findings.filter((f) => f.code === "temporary")).toHaveLength(2);
    expect(analysis.findings.find((f) => f.code === "mixed")?.message).toContain("301, 302, 307, 308");
  });

  it("treats an HTTPS → HTTP downgrade as an error and a missing HTTPS upgrade as a warning", async () => {
    const { analysis } = await check(DOWNGRADE, "https://legacy.example.net/");
    expect(analysis.findings[0]).toMatchObject({ severity: "error", code: "downgrade" });
    const plain = await check({ "http://plain.example.com/": { status: 200, headers: { "content-type": "text/html" } } }, "http://plain.example.com/");
    expect(codes(plain.analysis)).toEqual(expect.arrayContaining(["no_https", "no_redirect"]));
  });

  it("reports a chain that ends in an error page", async () => {
    const { analysis } = await check(BROKEN_END, "https://example.com/blog");
    expect(analysis.findings[0]).toMatchObject({ severity: "error", code: "final_error" });
    expect(analysis.recommendation).toMatch(/page that exists/);
  });

  it("reports meta refresh and JavaScript redirects as information only, without following them", async () => {
    const { analysis, calls } = await check(CLIENT_SIDE, "https://promo.example.com/");
    expect(calls).toHaveLength(1);
    const info = analysis.findings.filter((f) => f.code === "meta-refresh" || f.code === "javascript");
    expect(info.map((f) => f.severity)).toEqual(["info", "info"]);
    expect(info[0].message).toContain("https://promo.example.com/landing");
    expect(info[0].message).toContain("after 5 s");
    expect(findClientRedirects('<script>const location = "Paris";</script>', "https://a.example/")).toEqual([]);
  });
});

describe("input safety", () => {
  it("rejects credentials, other schemes, odd ports and private addresses before any request", () => {
    expect(normalizeUrl("www.github.com")).toEqual({ ok: true, url: "http://www.github.com/" });
    for (const bad of ["https://user:pass@example.com", "ftp://example.com", "file:///etc/passwd", "javascript:alert(1)", "http://example.com:8080", "http://localhost/", "http://10.0.0.5/", "http://192.168.1.1", "http://[::1]/", "http://169.254.169.254/latest", "http://intranet/"]) {
      expect(normalizeUrl(bad).ok, bad).toBe(false);
    }
    expect(normalizeUrl("https://example.com/" + "a".repeat(2048)).ok).toBe(false);
  });

  it("turns kit rejections into friendly errors, and keeps hops already followed", async () => {
    const blocked = mockFetcher({ "https://evil.example/": { status: 0, error: "blocked_host" } });
    await expect(run({ url: "https://evil.example/", userAgent: "default" }, { fetcher: blocked.fetcher })).rejects.toThrow(ChainError);
    await expect(run({ url: "https://evil.example/", userAgent: "default" }, { fetcher: blocked.fetcher })).rejects.toThrow(/private, local or reserved/);
    const midway = await check({ "https://a.example/": { status: 301, headers: { location: "https://b.example/" } }, "https://b.example/": { status: 0, error: "timeout" } }, "https://a.example/");
    expect(midway.result.stop).toMatchObject({ reason: "error", url: "https://b.example/" });
    expect(midway.result.stop?.message).toMatch(/10 seconds/);
  });
});

describe("route and export", () => {
  afterEach(() => vi.resetModules());

  it("answers with the response contract", async () => {
    vi.doMock("@/lib/tools/safe-fetch", async (orig) => {
      const real = await orig<typeof import("@/lib/tools/safe-fetch")>();
      return { ...real, safeFetch: mockFetcher(TWO_HOP).fetcher };
    });
    const { POST } = await import("../src/api/route");
    const post = (body: unknown) => POST(new Request("http://localhost/api", { method: "POST", body: JSON.stringify(body) }));
    const ok = await post({ url: "www.github.com" });
    expect(ok.status).toBe(200);
    const json = await ok.json();
    expect(json.ok).toBe(true);
    expect(json.data.recommendation).toMatch(/single 301/);
    const bad = await post({ url: "ftp://example.com" });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ ok: false, error: { code: "invalid_input", message: "Only http:// and https:// URLs can be checked, not ftp:." } });
    expect((await post({ url: "" })).status).toBe(400);
    expect((await post({ url: "https://a.example", userAgent: "curl" })).status).toBe(400);
  });

  it("exports the chain as text and CSV", async () => {
    const { result, analysis } = await check(TWO_HOP, EXAMPLE_URL);
    const text = reportText(result, analysis);
    expect(text).toContain("1. 301 Moved Permanently  http://www.github.com/  (62 ms)");
    expect(text).toContain("Recommendation: Collapse to a single 301");
    expect(reportCsv(result).split("\r\n")[1]).toBe("1,http://www.github.com/,301,Moved Permanently,permanent,https://www.github.com/,62,57");
    expect(new SafeFetchError("timeout", "x").code).toBe("timeout");
  });
});
