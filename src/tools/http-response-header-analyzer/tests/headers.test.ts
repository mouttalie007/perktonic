import { afterEach, describe, expect, it, vi } from "vitest";
import { analyze } from "../src/logic/analyze";
import { run, validateCustomHeaders, type RunInput } from "../src/logic/fetchHeaders";
import { checkCaching, checkCompression, parseCookies } from "../src/logic/performance";
import { headersCsv, reportText } from "../src/logic/report";
import { checkCsp, checkHsts, checkReferrer, gradeFor, gradeSecurity, RUBRIC } from "../src/logic/security";
import { buildSnippet } from "../src/logic/snippets";
import { normalizeUrl } from "../src/logic/url";
import { mockFetcher, type FakePage } from "../fixtures/mockFetcher";
import { EXAMPLE_URL, HEAD_REFUSED, STRONG, WEAK } from "../fixtures/sites";

const analyse = async (pages: Record<string, FakePage>, url: string, patch: Partial<RunInput> = {}) => {
  const m = mockFetcher(pages);
  const result = await run({ url, method: "HEAD", followRedirects: true, headers: {}, ...patch }, { fetcher: m.fetcher });
  return { result, analysis: analyze(result), calls: m.calls };
};
const H = (o: Record<string, string | string[]>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Array.isArray(v) ? v : [v]]));

describe("grading", () => {
  it("grades a strong site A with exact points per header", async () => {
    const { analysis } = await analyse(STRONG, EXAMPLE_URL);
    expect(analysis.security.checks.map((c) => [c.id, c.points])).toEqual([
      ["hsts", 25], ["csp", 25], ["xfo", 15], ["xcto", 15], ["referrer", 10], ["permissions", 0],
    ]);
    expect(analysis.security.score).toBe(90);
    expect(analysis.security.grade).toBe("A");
    expect(analysis.security.checks[0].notes.join(" ")).toMatch(/meets the preload list requirements/);
  });

  it("grades a weak site F and explains every deduction", async () => {
    const { analysis, result } = await analyse(WEAK, "http://shop.example.com/");
    expect(result.finalUrl).toBe("https://shop.example.com/");
    expect(result.redirects).toEqual([{ url: "http://shop.example.com/", status: 301, location: "https://shop.example.com/" }]);
    expect(analysis.security.score).toBe(17);
    expect(analysis.security.grade).toBe("F");
    const csp = analysis.security.checks.find((c) => c.id === "csp")!;
    expect(csp.points).toBe(5);
    expect(csp.notes.join(" ")).toMatch(/'unsafe-inline'[\s\S]*'unsafe-eval'[\s\S]*wildcard/);
  });

  it("scores HSTS max-age, includeSubDomains, max-age=0 and plain HTTP correctly", () => {
    expect(checkHsts(H({ "strict-transport-security": "max-age=31536000" }), true).points).toBe(20);
    expect(checkHsts(H({ "strict-transport-security": "max-age=15768000; includeSubDomains" }), true).points).toBe(20);
    expect(checkHsts(H({ "strict-transport-security": "max-age=0" }), true).points).toBe(0);
    expect(checkHsts(H({ "strict-transport-security": "includeSubDomains" }), true).notes[0]).toMatch(/max-age is missing/);
    expect(checkHsts(H({ "strict-transport-security": "max-age=31536000; includeSubDomains" }), false).points).toBe(0);
    expect(checkHsts(H({ "strict-transport-security": "max-age=600; preload" }), true).notes.join(" ")).toMatch(/preload list also needs/);
  });

  it("only forgives CSP 'unsafe-inline' when a nonce, hash or strict-dynamic is present", () => {
    expect(checkCsp(H({ "content-security-policy": "script-src 'self' 'unsafe-inline'; object-src 'none'" })).points).toBe(15);
    expect(checkCsp(H({ "content-security-policy": "script-src 'nonce-r4nd0m' 'unsafe-inline'; object-src 'none'" })).points).toBe(25);
    expect(checkCsp(H({ "content-security-policy-report-only": "default-src 'self'" }))).toMatchObject({ points: 5, status: "partial" });
  });

  it("uses the last valid Referrer-Policy value, as browsers do", () => {
    expect(checkReferrer(H({ "referrer-policy": "unsafe-url, strict-origin-when-cross-origin" })).points).toBe(10);
    expect(checkReferrer(H({ "referrer-policy": "no-referrer, foo" })).points).toBe(10);
    expect(checkReferrer(H({ "referrer-policy": "origin" })).points).toBe(5);
  });

  it("documents a rubric that adds up to 100 and matches the grade bands", () => {
    expect(RUBRIC.reduce((s, r) => s + r.max, 0)).toBe(100);
    expect(gradeSecurity({}, "https://x.example/").checks.reduce((s, c) => s + c.max, 0)).toBe(100);
    expect([100, 95, 94, 85, 70, 55, 40, 39].map(gradeFor)).toEqual(["A+", "A+", "A", "A", "B", "C", "D", "F"]);
  });
});

describe("fetching", () => {
  it("falls back to GET with a 64 KB body cap when HEAD is refused", async () => {
    const { result, calls } = await analyse(HEAD_REFUSED, "https://api.example.org/status");
    expect(calls.map((c) => c.opts.method)).toEqual(["HEAD", "GET"]);
    expect(calls[1].opts.maxBytes).toBe(64 * 1024);
    expect(result.method).toBe("GET");
    expect(result.status).toBe(200);
    expect(result.fallback).toMatch(/HEAD with 405/);
  });

  it("falls back to GET when the HEAD request fails outright", async () => {
    const { result } = await analyse({ "HEAD https://a.example/": { status: 0, error: "network" }, "GET https://a.example/": { status: 200, headers: { "content-type": "text/plain" } } }, "https://a.example/");
    expect(result.method).toBe("GET");
    expect(result.fallback).toMatch(/did not answer the HEAD/);
  });

  it("keeps repeated headers: every Set-Cookie is listed and checked", async () => {
    const { analysis } = await analyse(STRONG, EXAMPLE_URL);
    expect(analysis.rows.filter((r) => r.name === "set-cookie")).toHaveLength(3);
    expect(analysis.cookies.map((c) => c.name)).toEqual(["_gh_sess", "_octo", "logged_in"]);
    const weak = parseCookies(H({ "set-cookie": WEAK["https://shop.example.com/"].headers!["set-cookie"] }), true);
    expect(weak[0].issues.join("; ")).toMatch(/Secure[\s\S]*HttpOnly[\s\S]*SameSite/);
    expect(weak[1].issues.join("; ")).toMatch(/SameSite=None requires Secure/);
  });

  it("sends custom request headers and rejects unsafe ones", async () => {
    const ok = validateCustomHeaders([{ name: "Accept-Language", value: "ar" }, { name: "", value: "" }]);
    expect(ok).toEqual({ ok: true, headers: { "accept-language": "ar" } });
    const { calls } = await analyse(STRONG, EXAMPLE_URL, { headers: { "accept-language": "ar" } });
    expect(calls[0].opts.headers?.["accept-language"]).toBe("ar");
    expect(validateCustomHeaders([{ name: "Host", value: "evil" }]).ok).toBe(false);
    expect(validateCustomHeaders([{ name: "X-Test", value: "a\r\nInjected: 1" }]).ok).toBe(false);
    expect(validateCustomHeaders([{ name: "Bad Name", value: "x" }]).ok).toBe(false);
    expect(validateCustomHeaders(Array.from({ length: 11 }, (_, i) => ({ name: `X-${i}`, value: "1" }))).ok).toBe(false);
  });

  it("rejects private addresses and credentials, and maps kit errors to friendly messages", async () => {
    for (const bad of ["http://127.0.0.1", "https://u:p@example.com", "gopher://example.com", "http://[fd00::1]/"]) expect(normalizeUrl(bad).ok, bad).toBe(false);
    expect(normalizeUrl("example.com")).toEqual({ ok: true, url: "https://example.com/" });
    const m = mockFetcher({ "https://blocked.example/": { status: 0, error: "blocked_host" } });
    await expect(run({ url: "https://blocked.example/", method: "GET", followRedirects: true, headers: {} }, { fetcher: m.fetcher })).rejects.toThrow(/private, local or reserved/);
  });
});

describe("caching and compression", () => {
  it("flags conflicting Cache-Control combinations", () => {
    const msgs = (o: Record<string, string>) => checkCaching(H(o)).map((n) => `${n.level}: ${n.message}`).join("\n");
    expect(msgs({ "cache-control": "no-store, max-age=3600, public" })).toMatch(/warn: no-store is combined/);
    expect(msgs({ "cache-control": "private, s-maxage=600" })).toMatch(/warn: private and s-maxage conflict/);
    expect(msgs({ "content-type": "text/html", "cache-control": "public, max-age=604800, immutable" })).toMatch(/HTML is cached for 7 days[\s\S]*immutable on an HTML page/);
    expect(msgs({})).toMatch(/warn: No Cache-Control or Expires/);
    expect(msgs({ "cache-control": "public, max-age=31536000, immutable", "content-type": "application/javascript", etag: "x" })).toMatch(/pass: Cached for 365 day/);
    expect(msgs({ vary: "*", "cache-control": "max-age=60" })).toMatch(/Vary: \*/);
  });

  it("checks compression by content type", () => {
    expect(checkCompression(H({ "content-type": "text/html", "content-encoding": "br" }), "GET")[0].level).toBe("pass");
    expect(checkCompression(H({ "content-type": "application/json" }), "GET")[0].level).toBe("fail");
    expect(checkCompression(H({ "content-type": "image/webp" }), "GET")[0].level).toBe("info");
    expect(checkCompression(H({ "content-type": "text/css" }), "HEAD")[0].message).toMatch(/try the GET method/);
  });
});

describe("snippets and export", () => {
  it("generates Nginx, Apache and Caddy configuration for what is missing", async () => {
    const { analysis } = await analyse(WEAK, "http://shop.example.com/");
    const nginx = analysis.snippets.nginx;
    expect(nginx).toContain('add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;');
    expect(nginx).toContain('add_header X-Content-Type-Options "nosniff" always;');
    expect(nginx).toContain("server_tokens off;");
    expect(nginx).toContain("gzip on;");
    expect(analysis.snippets.apache).toContain('Header always set Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()"');
    expect(analysis.snippets.apache).toContain("ServerTokens Prod");
    expect(analysis.snippets.caddy).toMatch(/encode zstd gzip\nheader \{\n\t# /);
    expect(analysis.snippets.caddy).toContain("\t-Server");
    const strong = await analyse(STRONG, EXAMPLE_URL);
    expect(strong.analysis.snippets.nginx).toBe("# Inside the server { } block (or http { } for all sites). 'always' also adds headers to error pages.\n# Permissions-Policy (missing)\nadd_header Permissions-Policy \"camera=(), microphone=(), geolocation=(), payment=()\" always;\n");
    expect(buildSnippet("caddy", { checks: [], notes: [] })).toMatch(/Nothing to change/);
  });

  it("answers with the response contract and exports text and CSV", async () => {
    vi.doMock("@/lib/tools/safe-fetch", async (orig) => ({ ...(await orig<typeof import("@/lib/tools/safe-fetch")>()), safeFetch: mockFetcher(STRONG).fetcher }));
    const { POST } = await import("../src/api/route");
    const post = (body: unknown) => POST(new Request("http://localhost/api", { method: "POST", body: JSON.stringify(body) }));
    const ok = await (await post({ url: "github.com" })).json();
    expect(ok.ok).toBe(true);
    expect(ok.data.security.grade).toBe("A");
    const bad = await post({ url: "https://github.com", headers: [{ name: "Host", value: "x" }] });
    expect(bad.status).toBe(400);
    expect((await bad.json()).error.message).toMatch(/Host header cannot be set/);
    const { result, analysis } = await analyse(STRONG, EXAMPLE_URL);
    expect(reportText(result, analysis)).toContain("Security grade: A (90/100)");
    expect(headersCsv(analysis).split("\r\n")[0]).toBe("name,value");
  });

  afterEach(() => vi.resetModules());
});
