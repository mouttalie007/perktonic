import { describe, expect, it, vi } from "vitest";
import { run } from "../src/logic/check";
import { BATCH_SIZE, HOST_GAP_MS, MAX_URLS } from "../src/logic/limits";
import { checkListFile, chunk, parseList } from "../src/logic/parse";
import { counts, filterRows, sortRows, toCsv, toTsv, type Row } from "../src/logic/table";
import { CSV_NO_HEADER, CSV_WITH_HEADER, EXAMPLE_LIST } from "../fixtures/examples";
import { mockNetwork } from "../fixtures/mockFetcher";

const opts = { followRedirects: true, headFirst: true };

describe("reading the list", () => {
  it("reads one URL per line, adds https://, and skips invalid lines and duplicates", () => {
    const p = parseList(EXAMPLE_LIST);
    expect(p.format).toBe("One URL per line");
    expect(p.urls).toHaveLength(10);
    expect(p.urls).toContain("https://nodejs.org/learn/sitemap.xml");
    const skipped = p.items.filter((i) => i.skip);
    expect(skipped.map((i) => [i.line, i.skip, i.note])).toEqual([
      [11, "duplicate", "Duplicate of line 3."],
      [12, "invalid", "Not a URL."],
    ]);
    expect(p.items.find((i) => i.line === 8)?.note).toBe("https:// added");
    const bad = parseList("ftp://files.example.com/a\nhttps://user:pw@example.com/\nhttps://example.com:8080/\n/relative/path\nhttps://example.com/" + "a".repeat(2100));
    expect(bad.urls).toEqual([]);
    expect(bad.items.map((i) => i.note)).toEqual([
      "Only http and https URLs can be checked (this one is ftp).",
      "URLs with a user name or password are not checked.",
      "Only the standard ports (80 and 443) can be checked, not 8080.",
      "A path without a domain. Write the full URL, e.g. https://example.com/page.",
      "Longer than 2,048 characters.",
    ]);
  });

  it("reads CSV with a header (finding the URL column by name) and without one", () => {
    const withHeader = parseList(CSV_WITH_HEADER);
    expect(withHeader.format).toBe("CSV (comma-separated) with a header, column “Address”");
    expect(withHeader.urls).toEqual(["https://www.example.com/", "https://www.example.com/pricing", "http://example.com/blog/2019/launch"]);
    expect(withHeader.items.at(-1)?.skip).toBe("invalid");
    const noHeader = parseList(CSV_NO_HEADER);
    expect(noHeader.format).toBe("CSV (semicolon-separated) without a header, column 1");
    expect(noHeader.urls).toEqual(["https://shop.example.org/", "https://shop.example.org/cart"]);
    expect(noHeader.items[2].note).toBe("Duplicate of line 1.");
    // A header with an unknown name: the column is chosen by its content.
    expect(parseList("name\tlink to check\nA\thttps://a.example.com/\nB\thttps://b.example.com/").urls).toEqual(["https://a.example.com/", "https://b.example.com/"]);
  });

  it("caps a check at 50 URLs, splits them into batches of 5 and rejects binary uploads", () => {
    const list = Array.from({ length: 60 }, (_, i) => `https://example.com/page-${i}`).join("\n");
    const p = parseList(list);
    expect(p.urls).toHaveLength(MAX_URLS);
    expect(p.items.filter((i) => i.skip === "over_limit")).toHaveLength(10);
    expect(chunk(p.urls, BATCH_SIZE).map((b) => b.length)).toEqual(Array(10).fill(5));
    expect(checkListFile(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), 100, "links.xlsx")).toMatch(/Excel file/);
    expect(checkListFile(new Uint8Array([0x68, 0x00]), 100, "links.txt")).toMatch(/binary/);
    expect(checkListFile(new Uint8Array([0x68]), 2 * 1024 * 1024, "links.csv")).toMatch(/limit is 1 MB/);
    expect(checkListFile(new TextEncoder().encode("https://a.example/"), 18, "links.txt")).toBeNull();
  });
});

describe("checking URLs", () => {
  it("uses HEAD, falls back to GET when HEAD is refused, and reads the content type", async () => {
    const net = mockNetwork({
      "https://a.example.com/": { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
      "https://b.example.com/file.pdf": { status: 200, headStatus: 405, headers: { "content-type": "application/pdf" } },
    });
    const { results } = await run({ urls: ["https://a.example.com/", "https://b.example.com/file.pdf"], ...opts }, net);
    expect(results[0]).toMatchObject({ status: 200, statusText: "OK", method: "HEAD", contentType: "text/html", redirects: 0, error: null });
    expect(results[1]).toMatchObject({ status: 200, method: "GET", contentType: "application/pdf" });
    expect(net.calls.map((c) => `${c.method} ${c.url}`)).toEqual(["HEAD https://a.example.com/", "HEAD https://b.example.com/file.pdf", "GET https://b.example.com/file.pdf"]);
    expect(net.calls[2].maxBytes).toBe(64 * 1024);
    // Response time counts the requests only (HEAD + GET here), not the wait between requests to a host.
    const alone = await run({ urls: ["https://b.example.com/file.pdf"], ...opts }, mockNetwork({ "https://b.example.com/file.pdf": { status: 200, headStatus: 405, ms: 40 } }));
    expect(alone.results[0].timeMs).toBe(80);
    const getOnly = mockNetwork({ "https://a.example.com/": { status: 204 } });
    await run({ urls: ["https://a.example.com/"], followRedirects: true, headFirst: false }, getOnly);
    expect(getOnly.calls.map((c) => c.method)).toEqual(["GET"]);
  });

  it("follows redirects (relative ones too) or reports the first answer when asked not to", async () => {
    const pages = {
      "http://old.example.com/blog": { status: 301, headers: { location: "https://old.example.com/blog" } },
      "https://old.example.com/blog": { status: 302, headers: { location: "/news/" } },
      "https://old.example.com/news/": { status: 200, headers: { "content-type": "text/html" } },
    };
    const follow = await run({ urls: ["http://old.example.com/blog"], ...opts }, mockNetwork(pages));
    expect(follow.results[0]).toMatchObject({ status: 200, finalUrl: "https://old.example.com/news/", redirects: 2, chain: [301, 302, 200], error: null });
    const noFollow = await run({ urls: ["http://old.example.com/blog"], followRedirects: false, headFirst: true }, mockNetwork(pages));
    expect(noFollow.results[0]).toMatchObject({ status: 301, statusText: "Moved Permanently", finalUrl: "https://old.example.com/blog", redirects: 0, chain: [301] });
  });

  it("turns loops, too many redirects and network problems into rows with a reason", async () => {
    const pages: Record<string, { status: number; headers?: Record<string, string>; error?: "timeout" | "blocked_host" }> = {
      "https://loop.example.com/a": { status: 302, headers: { location: "/b" } },
      "https://loop.example.com/b": { status: 302, headers: { location: "/a" } },
      "https://slow.example.com/": { status: 200, error: "timeout" },
      "https://internal.example.com/": { status: 200, error: "blocked_host" },
    };
    for (let i = 0; i < 12; i++) pages[`https://chain.example.com/${i}`] = { status: 301, headers: { location: `/${i + 1}` } };
    const { results } = await run({ urls: ["https://loop.example.com/a", "https://chain.example.com/0", "https://slow.example.com/", "https://internal.example.com/", "https://gone.example.com/"], ...opts }, mockNetwork(pages));
    expect(results.map((r) => r.error?.code)).toEqual(["redirect_loop", "too_many_redirects", "timeout", "blocked_host", "network"]);
    expect(results[0].error?.message).toBe("Redirect loop: https://loop.example.com/a was already visited.");
    expect(results[1].redirects).toBe(10);
    expect(results[2]).toMatchObject({ status: null, statusText: "No response", error: { message: "No answer within 10 seconds." } });
    expect(results[4].error?.message).toMatch(/Could not connect/);
  });

  it("checks at most 3 URLs at once, one request at a time per host, 250 ms apart", async () => {
    const pages: Record<string, { status: number }> = {};
    const urls = ["https://one.example.com/1", "https://one.example.com/2", "https://one.example.com/3", "https://two.example.com/1", "https://three.example.com/1"];
    for (const u of urls) pages[u] = { status: 200 };
    const net = mockNetwork(pages);
    const { results } = await run({ urls, ...opts }, net);
    expect(results.map((r) => r.url)).toEqual(urls);
    expect(net.stats().maxActive).toBeLessThanOrEqual(3);
    expect(net.stats().maxPerHost).toBe(1);
    const one = net.calls.filter((c) => c.url.startsWith("https://one."));
    for (let i = 1; i < one.length; i++) expect(one[i].start - one[i - 1].end).toBeGreaterThanOrEqual(HOST_GAP_MS);
  });
});

describe("results table and export", () => {
  const rows: Row[] = [
    { index: 1, url: "https://a.example.com/", status: 200, statusText: "OK", finalUrl: "https://a.example.com/", redirects: 0, chain: [200], timeMs: 120, contentType: "text/html", method: "HEAD", error: null },
    { index: 2, url: "http://a.example.com/old", status: 200, statusText: "OK", finalUrl: "https://a.example.com/new", redirects: 1, chain: [301, 200], timeMs: 300, contentType: "text/html", method: "HEAD", error: null },
    { index: 3, url: "https://a.example.com/=cmd", status: 404, statusText: "Not Found", finalUrl: "https://a.example.com/=cmd", redirects: 0, chain: [404], timeMs: 90, contentType: "text/html", method: "GET", error: null },
    { index: 4, url: "https://down.example.com/", status: null, statusText: "No response", finalUrl: null, redirects: 0, chain: [], timeMs: 10000, contentType: null, method: "HEAD", error: { code: "timeout", message: "No answer within 10 seconds." } },
  ];

  it("filters by status group and text, and sorts with errors last", () => {
    expect(counts(rows)).toMatchObject({ all: 4, "2xx": 2, "4xx": 1, error: 1, redirected: 1 });
    expect(filterRows(rows, "4xx", "").map((r) => r.index)).toEqual([3]);
    expect(filterRows(rows, "redirected", "").map((r) => r.index)).toEqual([2]);
    expect(filterRows(rows, "all", "down.").map((r) => r.index)).toEqual([4]);
    expect(sortRows(rows, "status", "asc").map((r) => r.index)).toEqual([1, 2, 3, 4]);
    expect(sortRows(rows, "timeMs", "desc").map((r) => r.index)).toEqual([4, 2, 1, 3]);
  });

  it("exports CSV as UTF-8 with a BOM, CRLF and quoting, and guards against formulas", () => {
    const csv = toCsv(rows);
    expect(csv.startsWith("﻿#,URL,Status,Status text,Final URL,Redirects,Redirect chain,Time (ms),Content type,Method,Problem\r\n")).toBe(true);
    expect(csv).toContain("2,http://a.example.com/old,200,OK,https://a.example.com/new,1,301 > 200,300,text/html,HEAD,\r\n");
    expect(csv).toContain("4,https://down.example.com/,,No response,,0,,10000,,HEAD,No answer within 10 seconds.\r\n");
    expect(toCsv([{ ...rows[0], url: "=HYPERLINK(\"x\")" }])).toContain("1,\"'=HYPERLINK(\"\"x\"\")\"");
    expect(toTsv(rows).split("\n")[1]).toBe("1\thttps://a.example.com/\t200\tOK\thttps://a.example.com/\t0\t200\t120\ttext/html\tHEAD\t");
  });
});

describe("route", () => {
  it("validates input and answers with the response contract", async () => {
    vi.resetModules();
    vi.doMock("@/lib/tools/safe-fetch", () => ({
      safeFetch: async (url: string) => ({ url, status: 200, headers: { "content-type": ["text/plain"] }, body: new Uint8Array(), truncated: false, timings: { dnsMs: null, connectMs: null, tlsMs: null, ttfbMs: 1, totalMs: 1 }, remoteIp: null }),
    }));
    const { POST } = await import("../src/api/route");
    const call = (body: unknown) => POST(new Request("http://localhost/api", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }));
    const ok = await call({ urls: ["example.com/a"] });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ ok: true, data: { results: [{ url: "https://example.com/a", status: 200, contentType: "text/plain" }] } });
    const tooMany = await call({ urls: Array(6).fill("https://example.com/") });
    expect(tooMany.status).toBe(400);
    expect(await tooMany.json()).toMatchObject({ ok: false, error: { code: "invalid_input", message: expect.stringMatching(/at most 5 URLs/) } });
    expect((await call({ urls: ["javascript:alert(1)"] })).status).toBe(400);
    expect((await POST(new Request("http://localhost/api", { method: "POST", body: "{nope" }))).status).toBe(400);
    vi.doUnmock("@/lib/tools/safe-fetch");
  });
});
