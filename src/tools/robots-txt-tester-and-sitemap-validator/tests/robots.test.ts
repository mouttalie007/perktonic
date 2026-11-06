import { gzipSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";
import { groupsFor, matches, normalizePath, parseRobots, testPath } from "../src/logic/robots";
import { run, siteOrigin } from "../src/logic/run";
import { analyzeSitemap, checkLastmod, registrableDomain } from "../src/logic/sitemap";
import { INDEX, SHOP_ROBOTS, URLSET } from "../fixtures/examples";
import { mockFetcher } from "../fixtures/mockFetcher";

const NOW = Date.parse("2026-10-30T12:00:00Z");
const robots = parseRobots(SHOP_ROBOTS);
const allowed = (path: string, ua: string) => testPath(robots, path, ua).allowed;

describe("robots.txt parsing", () => {
  it("reads groups (several User-agent lines share one), rules, sitemaps and crawl-delay, and flags mistakes", () => {
    expect(robots.groups.map((g) => [g.agents, g.rules.length, g.crawlDelay])).toEqual([
      [["*"], 7, null],
      [["Googlebot", "Bingbot"], 2, 5],
      [["GPTBot"], 1, null],
      [["googlebot"], 2, null],
    ]);
    expect(robots.sitemaps).toEqual([{ url: "https://shop.example.com/sitemap_index.xml", line: 25 }]);
    const msgs = robots.issues.map((i) => `${i.line}:${i.severity}:${i.message.slice(0, 40)}`);
    expect(msgs).toEqual([
      "15:info:Crawl-delay: 5 is honoured by Bing and Y",
      "23:warning:“Dissallow” is a misspelling of “Disallo",
      "24:info:Noindex is not supported in robots.txt (",
      "26:error:Sitemap must be a full URL (https://…), ",
    ]);
    expect(parseRobots("Disallow: /x\nUser-agent: *\nDisallow /y").issues.map((i) => [i.line, i.severity])).toEqual([[1, "error"], [3, "warning"], [2, "info"]]);
    expect(parseRobots("<!DOCTYPE html><html><body>Not found</body></html>").issues[0].message).toMatch(/HTML page/);
  });
});

describe("matching rules", () => {
  it("handles * wildcards, $ anchors and percent-encoding", () => {
    expect(matches("/*.pdf$", "/files/guide.pdf")).toBe(true);
    expect(matches("/*.pdf$", "/files/guide.pdf?x=1")).toBe(false);
    expect(matches("/*?sort=", "/shoes?sort=price&colour=red")).toBe(true);
    expect(matches("/*?sort=", "/shoes?colour=red&sort=price")).toBe(false);
    expect(matches("/fish", "/fish.html")).toBe(true);
    expect(matches("/fish$", "/fish.html")).toBe(false);
    expect(matches("/a*b*c", "/a" + "x".repeat(5000))).toBe(false);
    expect(normalizePath("/café")).toBe("/caf%C3%A9");
    expect(normalizePath("/caf%c3%a9")).toBe("/caf%C3%A9");
    expect(allowed("https://shop.example.com/guide.pdf", "Slurp")).toBe(false);
    expect(allowed("/shoes?sort=price", "Slurp")).toBe(false);
  });

  it("uses the longest matching rule, with Allow winning a tie", () => {
    expect(testPath(robots, "/checkout/help", "Slurp")).toMatchObject({ allowed: true, rule: { type: "allow", path: "/checkout/help", line: 7 } });
    expect(allowed("/checkout/pay", "Slurp")).toBe(false);
    // "Disallow: /search" and "Allow: /search" are the same length, so Allow wins.
    expect(testPath(robots, "/search?q=mugs", "Slurp")).toMatchObject({ allowed: true, rule: { line: 9 } });
    expect(allowed("/robots.txt", "GPTBot")).toBe(true);
    expect(testPath(parseRobots("User-agent: *\nDisallow: /a\nAllow: /a/b/c"), "/a/b/c/d", "x").allowed).toBe(true);
  });

  it("picks the right group for each crawler and merges groups with the same name", () => {
    // Googlebot has two groups (lines 11 and 20); they are merged, and the * group does not apply.
    expect(groupsFor(robots, "Googlebot").map((g) => g.line)).toEqual([11, 20]);
    expect(allowed("/drafts/x", "Googlebot")).toBe(false);
    expect(allowed("/cart", "Googlebot")).toBe(true);
    expect(allowed("/private/press-kit/logo.png", "Googlebot/2.1 (+http://www.google.com/bot.html)")).toBe(true);
    // Googlebot-Image has no group of its own, so it follows the most specific one: googlebot.
    expect(groupsFor(robots, "Googlebot-Image").map((g) => g.line)).toEqual([11, 20]);
    expect(allowed("/anything", "GPTBot")).toBe(false);
    expect(allowed("/cart", "DuckDuckBot")).toBe(false);
    expect(testPath(parseRobots("User-agent: GPTBot\nDisallow: /"), "/x", "Bingbot").explanation).toMatch(/No group applies/);
  });
});

describe("sitemaps", () => {
  it("validates lastmod (W3C Datetime), changefreq, priority, namespace, duplicates and hosts", () => {
    expect(["2026", "2026-10", "2026-10-28", "2026-10-28T09:15+02:00", "2026-10-28T09:15:30.5Z"].map((v) => checkLastmod(v, NOW))).toEqual(Array(5).fill("valid"));
    expect(["2026-10-28 09:15", "28/10/2026", "2026-02-30", "2026-13-01", "1793324687"].map((v) => checkLastmod(v, NOW))).toEqual(Array(5).fill("invalid"));
    expect(checkLastmod("2027-01-01", NOW)).toBe("future");
    const xml = URLSET([
      { loc: "https://shop.example.com/", lastmod: "2026-10-28", changefreq: "daily", priority: "1.0" },
      { loc: "https://shop.example.com/a", lastmod: "28/10/2026", changefreq: "sometimes", priority: "2" },
      { loc: "https://shop.example.com/a", lastmod: "2027-05-01" },
      { loc: "https://cdn.example.net/b" },
      { loc: "/relative" },
    ], "");
    const r = analyzeSitemap(xml, "https://shop.example.com/sitemap.xml", NOW, false);
    expect(r.kind).toBe("urlset");
    expect(r.locs).toHaveLength(4);
    expect(r.lastmod).toMatchObject({ valid: 1, invalid: 1, future: 1, missing: 1, invalidExamples: ["28/10/2026"] });
    expect(r.issues.map((i) => i.message.slice(0, 32))).toEqual([
      "The <urlset> element has no xmln",
      "1 <loc> value is not a full http",
      "1 URL is on another host than sh",
      "1 duplicate <loc> value.",
      "1 <changefreq> value is not one ",
      "1 <priority> value is outside 0.",
      "1 <lastmod> value is not in W3C ",
      "1 <lastmod> date is in the futur",
    ]);
    expect(r.issues.find((i) => i.message.includes("W3C"))?.message).toMatch(/use YYYY-MM-DD, not a local date format/);
  });

  it("reports broken XML with its line, and refuses DOCTYPEs and HTML pages", () => {
    const bad = analyzeSitemap("<?xml version=\"1.0\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n<url><loc>https://a.example.com/?a=1&b=2</loc></url>\n</urlset>", "https://a.example.com/s.xml", NOW, false);
    expect(bad.issues[0]).toMatchObject({ severity: "error", line: 3 });
    expect(bad.issues[0].message).toMatch(/must be written as &amp;/);
    expect(analyzeSitemap("<?xml version=\"1.0\"?><!DOCTYPE x [<!ENTITY a \"aaaa\">]><urlset/>", "https://a.example.com/s.xml", NOW, false).issues[0].message).toMatch(/DOCTYPE/);
    expect(analyzeSitemap("<!DOCTYPE html><html></html>", "https://a.example.com/s.xml", NOW, false).issues[0].message).toMatch(/HTML page/);
    expect(registrableDomain("blog.shop.example.co.uk")).toBe("example.co.uk");
    expect(registrableDomain("www.example.com")).toBe("example.com");
  });
});

describe("full check", () => {
  const ORIGIN = "https://shop.example.com";
  const urls = (n: number, prefix: string) => Array.from({ length: n }, (_, i) => ({ loc: `${ORIGIN}${prefix}${i}`, lastmod: "2026-10-01" }));

  it("follows a sitemap index one level, stops at 5 files, skips other domains and counts URLs blocked by robots.txt", async () => {
    const files = {
      [`${ORIGIN}/robots.txt`]: { status: 200, headers: { "content-type": "text/plain" }, body: "User-agent: *\nDisallow: /private/\nSitemap: https://shop.example.com/sitemap_index.xml\nSitemap: https://other-site.example.org/sitemap.xml\n" },
      [`${ORIGIN}/sitemap_index.xml`]: { status: 200, headers: { "content-type": "application/xml" }, body: INDEX([1, 2, 3, 4, 5, 6].map((i) => `${ORIGIN}/sitemap-${i}.xml`).concat("https://cdn.shop.example.com/sitemap-images.xml")) },
      [`${ORIGIN}/sitemap.xml`]: { status: 301, headers: { location: "/sitemap_index.xml" } },
      [`${ORIGIN}/sitemap-1.xml`]: { status: 200, headers: { "content-type": "application/xml" }, body: URLSET([...urls(3, "/p/"), ...urls(2, "/private/")]) },
      [`${ORIGIN}/sitemap-2.xml`]: { status: 200, body: URLSET(urls(2, "/q/")) },
      [`${ORIGIN}/sitemap-3.xml`]: { status: 404 },
      [`${ORIGIN}/sitemap-4.xml`]: { status: 200, body: INDEX([`${ORIGIN}/deeper.xml`]) },
    };
    const net = mockFetcher(files);
    const data = await run({ origin: ORIGIN, urls: ["/private/x", "/p/1"], userAgents: ["Googlebot"] }, { fetcher: net.fetcher, now: () => NOW });
    expect(data.robots.state).toBe("found");
    expect(data.sitemaps.map((s) => [s.url.replace(ORIGIN, ""), s.source, s.kind, s.entryCount])).toEqual([
      ["/sitemap_index.xml", "robots", "sitemapindex", 7],
      ["/sitemap.xml", "default", "sitemapindex", 7],
      ["/sitemap-1.xml", "index", "urlset", 5],
      ["/sitemap-2.xml", "index", "urlset", 2],
      ["/sitemap-3.xml", "index", "unknown", 0],
    ]);
    expect(data.sitemaps[2]).toMatchObject({ blockedForGooglebot: 2, blockedExamples: [`${ORIGIN}/private/0`, `${ORIGIN}/private/1`] });
    expect(data.sitemaps[4].issues[0].message).toBe("HTTP 404: search engines cannot read this sitemap.");
    expect(data.notChecked.map((n) => [n.url.replace(ORIGIN, ""), n.reason.slice(0, 30)])).toEqual([
      ["https://other-site.example.org/sitemap.xml", "On another domain (other-site."],
      ["/sitemap-4.xml", "Not fetched: the limit is 5 si"],
      ["/sitemap-5.xml", "Not fetched: the limit is 5 si"],
      ["/sitemap-6.xml", "Not fetched: the limit is 5 si"],
      ["https://cdn.shop.example.com/sitemap-images.xml", "Not fetched: the limit is 5 si"],
    ]);
    expect(net.calls).not.toContain("https://other-site.example.org/sitemap.xml");
    expect(data.tests.map((t) => [t.url, t.allowed])).toEqual([["/private/x", false], ["/p/1", true]]);
  });

  it("unpacks .xml.gz, and reports files over our 2 MB cap and Google's 50,000-URL limit", async () => {
    const big = URLSET(urls(50_001, "/item/"));
    const files = {
      [`${ORIGIN}/robots.txt`]: { status: 200, body: "User-agent: *\nAllow: /\nSitemap: https://shop.example.com/a.xml.gz\nSitemap: https://shop.example.com/huge.xml\n" },
      [`${ORIGIN}/a.xml.gz`]: { status: 200, headers: { "content-type": "application/gzip" }, body: new Uint8Array(gzipSync(big)) },
      [`${ORIGIN}/huge.xml`]: { status: 200, headers: { "content-length": String(60 * 1024 * 1024) }, body: big + " ".repeat(2 * 1024 * 1024) },
      [`${ORIGIN}/sitemap.xml`]: { status: 404 },
    };
    const data = await run({ origin: ORIGIN, urls: [], userAgents: ["Googlebot"] }, { fetcher: mockFetcher(files).fetcher, now: () => NOW });
    const [gz, huge, missing] = data.sitemaps;
    expect(gz).toMatchObject({ gzipped: true, kind: "urlset", entryCount: 50_001, partial: false });
    expect(gz.unpackedBytes).toBeGreaterThan(gz.bytes);
    expect(gz.issues.some((i) => /Google reads at most 50,000/.test(i.message))).toBe(true);
    expect(huge.partial).toBe(true);
    expect(huge.issues.map((i) => i.message.slice(0, 45))).toEqual([
      "The file is larger than our 2 MB limit, so on",
      "The file is 60.0 MB uncompressed; Google read",
      "The server reports 60.0 MB for this file.",
    ]);
    expect(missing.issues[0].severity).toBe("info");
    const bomb = await run({ origin: ORIGIN, urls: [], userAgents: ["*"] }, { fetcher: mockFetcher({ [`${ORIGIN}/robots.txt`]: { status: 404 }, [`${ORIGIN}/sitemap.xml`]: { status: 200, body: new Uint8Array(gzipSync(Buffer.alloc(11 * 1024 * 1024, 32))) } }).fetcher, now: () => NOW });
    expect(bomb.sitemaps[0].issues[0].message).toMatch(/larger than 10 MB/);
  }, 20_000);

  it("explains missing, failing and unreachable robots.txt files", async () => {
    const check = (robotsFile: { status: number; error?: "timeout" }) => run({ origin: ORIGIN, urls: ["/x"], userAgents: ["Googlebot"] }, { fetcher: mockFetcher({ [`${ORIGIN}/robots.txt`]: robotsFile, [`${ORIGIN}/sitemap.xml`]: { status: 404 } }).fetcher, now: () => NOW });
    const missing = await check({ status: 404 });
    expect(missing.robots).toMatchObject({ state: "missing" });
    expect(missing.tests[0].allowed).toBe(true);
    const down = await check({ status: 503 });
    expect(down.robots.message).toMatch(/disallow everything/);
    expect(down.tests[0].allowed).toBe(false);
    const slow = await check({ status: 200, error: "timeout" });
    expect(slow.robots.message).toMatch(/did not answer within 10 seconds/);
    expect(siteOrigin("Shop.Example.com/blog?x=1")).toEqual({ ok: true, origin: "https://shop.example.com" });
    expect(siteOrigin("ftp://example.com")).toMatchObject({ ok: false });
    expect(siteOrigin("localhost")).toMatchObject({ ok: false });
  });
});

describe("route", () => {
  it("validates input and answers with the response contract", async () => {
    vi.resetModules();
    vi.doMock("@/lib/tools/safe-fetch", () => ({
      safeFetch: async (url: string) => ({ url, status: url.endsWith("robots.txt") ? 200 : 404, headers: { "content-type": ["text/plain"] }, body: new TextEncoder().encode("User-agent: *\nDisallow: /admin/\n"), truncated: false, timings: { dnsMs: null, connectMs: null, tlsMs: null, ttfbMs: 1, totalMs: 1 }, remoteIp: null }),
    }));
    const { POST } = await import("../src/api/route");
    const call = (body: unknown) => POST(new Request("http://localhost/api", { method: "POST", body: JSON.stringify(body) }));
    const ok = await call({ domain: "example.com", urls: ["/admin/users"] });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ ok: true, data: { origin: "https://example.com", robots: { state: "found" }, tests: [{ userAgent: "Googlebot", allowed: false }] } });
    const bad = await call({ domain: "example.com", urls: Array(11).fill("/x") });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toMatchObject({ ok: false, error: { code: "invalid_input", message: "Test at most 10 URLs at once." } });
    expect((await call({ domain: "javascript:alert(1)" })).status).toBe(400);
    vi.doUnmock("@/lib/tools/safe-fetch");
  });
});
