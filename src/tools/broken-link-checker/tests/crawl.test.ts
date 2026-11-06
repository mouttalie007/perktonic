import { describe, expect, it } from "vitest";
import { crawl } from "../src/logic/crawl";
import { extractLinks } from "../src/logic/html";
import { isAllowed, parseRobots } from "../src/logic/robots";
import { crawlCsv } from "../src/logic/report";
import { DEFAULT_OPTIONS, LIMITS, type CrawlEvent } from "../src/logic/types";
import { normalizeStart, resolveLink } from "../src/logic/url";
import { mockSite, ORIGIN, SITE } from "../fixtures/site";

const run = (opts = DEFAULT_OPTIONS, site = SITE) => {
  const m = mockSite(site);
  const events: CrawlEvent[] = [];
  return { m, events, result: crawl({ url: `${ORIGIN}/`, options: opts }, { fetcher: m.fetcher, sleep: m.sleep, now: m.now }, (e) => events.push(e)) };
};
const urls = (items: { url: string }[]) => items.map((i) => i.url.replace(ORIGIN, "")).sort();

describe("robots.txt and URLs", () => {
  it("uses the PerkTonicBot group over *, with longest-match and wildcard rules", () => {
    const r = parseRobots(SITE[`${ORIGIN}/robots.txt`].body!);
    expect(isAllowed(r, `${ORIGIN}/`)).toBe(true);
    expect(isAllowed(r, `${ORIGIN}/cart`)).toBe(false);
    expect(isAllowed(r, `${ORIGIN}/admin/users`)).toBe(false);
    const w = parseRobots("User-agent: *\nDisallow: /*.pdf$\nDisallow: /search\nAllow: /search/help\nCrawl-delay: 2");
    expect([isAllowed(w, "https://a.example/files/x.pdf"), isAllowed(w, "https://a.example/files/x.pdf?v=1"), isAllowed(w, "https://a.example/search?q=1"), isAllowed(w, "https://a.example/search/help")]).toEqual([false, true, false, true]);
    expect(w.crawlDelayMs).toBe(2000);
  });

  it("skips mailto, tel, javascript, data and fragments, and normalises the rest", () => {
    expect(["mailto:a@b.example", "tel:+1", "javascript:void(0)", "data:text/html,x", "#top"].map((h) => resolveLink(h, `${ORIGIN}/`).kind)).toEqual(["skip", "skip", "skip", "skip", "skip"]);
    expect(resolveLink("../a/./b?#frag", `${ORIGIN}/x/y/`)).toEqual({ kind: "url", url: `${ORIGIN}/x/a/b` });
    expect(resolveLink("HTTPS://Demo-Shop.example:443/P", `${ORIGIN}/`)).toEqual({ kind: "url", url: `${ORIGIN}/P` });
    expect(normalizeStart("demo-shop.example")).toEqual({ ok: true, url: `${ORIGIN}/` });
    for (const bad of ["http://localhost:3000", "https://192.168.0.10/", "ftp://x.example", "https://a.example:8080/"]) expect(normalizeStart(bad).ok, bad).toBe(false);
    const { links } = extractLinks(`<a href="/a"><img src="/i.png" alt="Logo"></a><a href="/b" aria-label="Next page"></a>`);
    expect(links).toEqual([
      { href: "/a", kind: "link", text: "[image: Logo]" },
      { href: "/b", kind: "link", text: "Next page" },
      { href: "/i.png", kind: "image", text: "Logo" },
    ]);
  });
});

describe("a crawl", () => {
  it("reports broken links, redirects and missing images with source page and anchor text", async () => {
    const { result } = run();
    const r = await result;
    expect(urls(r.broken)).toEqual(["/about/history", "/blog/2019-sale", "/team/grace", "https://old-partner.example/", "https://partner.example/gone", "https://slow.example/"]);
    expect(r.broken.find((b) => b.url === "https://partner.example/gone")).toMatchObject({ status: 404, internal: false, sources: [{ page: `${ORIGIN}/`, text: "Spring offer" }] });
    expect(r.broken.find((b) => b.url === "https://slow.example/")).toMatchObject({ status: null, error: "No answer within 10 s" });
    expect(r.broken.find((b) => b.url === "https://old-partner.example/")!.error).toMatch(/^Could not connect/);
    expect(r.redirects.map((x) => [x.url.replace(ORIGIN, ""), x.redirectTo])).toEqual([
      ["/blog/", `${ORIGIN}/blog`],
      ["https://partner.example/moved", "https://partner.example/size-guide"],
    ]);
    expect(r.missingImages).toEqual([expect.objectContaining({ url: `${ORIGIN}/img/missing-banner.jpg`, status: 404, sources: [{ page: `${ORIGIN}/`, text: "Autumn sale banner" }] })]);
    expect(r.stoppedEarly).toBeNull();
  });

  it("obeys robots.txt, depth 2, the query-variant guard and skips non-web links", async () => {
    const { result, m } = run();
    const r = await result;
    const fetched = m.calls.map((c) => c.url.replace(ORIGIN, ""));
    expect(fetched[0]).toBe("/robots.txt");
    expect(fetched).not.toContain("/cart");
    expect(fetched).not.toContain("/admin/");
    expect(r.skipped.robots).toBe(2);
    // ?page=4 is a fourth variant of /products.
    expect(fetched).not.toContain("/products?page=4");
    expect(r.skipped.queryVariants).toBe(1);
    expect(r.skipped.schemes).toBe(3);
    // /team is depth 2 (crawled); its links are depth 3 (checked with HEAD, not crawled).
    expect(m.calls.filter((c) => c.url.endsWith("/team")).map((c) => c.method)).toEqual(["GET"]);
    expect(m.calls.filter((c) => c.url.endsWith("/team/ada")).map((c) => c.method)).toEqual(["HEAD"]);
    // /, /about, /team, /blog (reached through the /blog/ redirect), its post and three product pages.
    expect(r.pagesCrawled).toBe(8);
  });

  it("is polite: PerkTonic user agent, ≥ 250 ms between requests to one host, ≤ 4 in flight, HEAD for external links with a GET retry on 405", async () => {
    const { result, m } = run();
    await result;
    expect(new Set(m.calls.map((c) => c.userAgent))).toEqual(new Set(["PerkTonicBot/1.0 (+https://perktonic.com/tools)"]));
    const byHost = new Map<string, number[]>();
    for (const c of m.calls) byHost.set(new URL(c.url).host, [...(byHost.get(new URL(c.url).host) ?? []), c.at]);
    for (const times of byHost.values()) {
      const sorted = [...times].sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(250);
    }
    expect(m.maxInFlight()).toBeLessThanOrEqual(4);
    expect(m.calls.filter((c) => c.url === "https://partner.example/no-head").map((c) => c.method)).toEqual(["HEAD", "GET"]);
    expect(m.calls.filter((c) => !c.url.startsWith(ORIGIN)).every((c) => c.method === "HEAD" || c.url.endsWith("no-head"))).toBe(true);
  });

  it("honours Crawl-delay and the page, depth and external options", async () => {
    const site = { ...SITE, [`${ORIGIN}/robots.txt`]: { status: 200, body: "User-agent: *\nCrawl-delay: 1\n" } };
    const { result, m } = run({ depth: 0, maxPages: 1, checkExternal: false, checkImages: false }, site);
    const r = await result;
    // After robots.txt has been read, its Crawl-delay applies.
    const own = m.calls.filter((c) => c.url.startsWith(ORIGIN) && !c.url.endsWith("/robots.txt")).map((c) => c.at).sort((a, b) => a - b);
    for (let i = 1; i < own.length; i++) expect(own[i] - own[i - 1]).toBeGreaterThanOrEqual(1000);
    expect(r.pagesCrawled).toBe(1);
    expect(m.calls.some((c) => !c.url.startsWith(ORIGIN))).toBe(false);
    expect(r.skipped.external).toBe(6);
    expect(r.skipped.images).toBe(2);
  });

  it("stops at the 90-second ceiling and returns what it found", async () => {
    const site = { ...SITE, [`${ORIGIN}/robots.txt`]: { status: 200, body: "User-agent: *\nCrawl-delay: 30\n" } };
    const { result } = run(DEFAULT_OPTIONS, site);
    const r = await result;
    expect(r.stoppedEarly).toBe("time");
    expect(r.durationMs).toBeLessThanOrEqual(LIMITS.ceilingMs + 1000);
    expect(r.pagesCrawled).toBeGreaterThan(0);
  });

  it("stops when cancelled, and refuses to start when robots.txt forbids it or cannot be read", async () => {
    const m = mockSite();
    const ctrl = new AbortController();
    let n = 0;
    const r = await crawl({ url: `${ORIGIN}/`, options: DEFAULT_OPTIONS }, { fetcher: async (u, o) => (++n === 5 && ctrl.abort(), m.fetcher(u, o)), sleep: m.sleep, now: m.now, signal: ctrl.signal });
    expect(r.stoppedEarly).toBe("cancelled");
    expect(m.calls.length).toBeLessThan(10);
    const blocked = { ...SITE, [`${ORIGIN}/robots.txt`]: { status: 200, body: "User-agent: *\nDisallow: /\n" } };
    await expect(run(DEFAULT_OPTIONS, blocked).result).rejects.toMatchObject({ code: "robots_disallowed" });
    const down = { ...SITE, [`${ORIGIN}/robots.txt`]: { status: 503 } };
    await expect(run(DEFAULT_OPTIONS, down).result).rejects.toMatchObject({ code: "robots_unavailable" });
  });

  it("caps the crawl at 300 checked links", async () => {
    const many: typeof SITE = { [`${ORIGIN}/robots.txt`]: { status: 404 }, [`${ORIGIN}/`]: { status: 200, body: Array.from({ length: 400 }, (_, i) => `<a href="https://ext${i}.example/">x</a>`).join(""), headers: { "content-type": "text/html" } } };
    for (let i = 0; i < 400; i++) many[`https://ext${i}.example/`] = { status: 200 };
    const { result, m, events } = run(DEFAULT_OPTIONS, many);
    const r = await result;
    expect(r.linksChecked).toBe(300);
    expect(r.skipped.overLimit).toBe(101);
    expect(r.stoppedEarly).toBe("links");
    expect(m.calls.length).toBe(301);
    expect(events.filter((e) => e.type === "progress").length).toBeGreaterThan(2);
  }, 20_000);

  it("exports problems as CSV, one row per source page", async () => {
    const r = await run().result;
    const csv = crawlCsv(r).split("\r\n");
    expect(csv[0]).toBe("problem,url,status,detail,redirect_to,source_page,anchor_text");
    expect(csv).toContain(`broken link,https://partner.example/gone,404,,,${ORIGIN}/,Spring offer`);
    expect(csv).toContain(`missing image,${ORIGIN}/img/missing-banner.jpg,404,,,${ORIGIN}/,Autumn sale banner`);
  });
});

describe("the route", () => {
  it("validates before crawling and answers errors with the JSON contract", async () => {
    const { POST } = await import("../src/api/route");
    const post = (body: unknown) => POST(new Request("http://localhost/api/tools/broken-link-checker", { method: "POST", body: JSON.stringify(body) }));
    const bad = await post({ url: "http://localhost:3000/" });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toMatchObject({ ok: false, error: { code: "invalid_input" } });
    const deep = await post({ url: "https://example.com/", depth: 5 });
    expect(deep.status).toBe(400);
  });
});
