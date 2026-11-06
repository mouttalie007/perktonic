import { describe, expect, it } from "vitest";
import { POST } from "../src/api/route";
import { DataSchema } from "../src/api/schema";
import { cacheStatus, MeasureError, median, parseServerTiming, phasesOf, protocolHint, run } from "../src/logic/measure";
import { reportText, runsCsv } from "../src/logic/report";
import { rate, TEST_LOCATION, THRESHOLD_SOURCE } from "../src/logic/types";
import { ipVersion, normalizeUrl } from "../src/logic/url";
import { mockFetcher } from "../fixtures/mockFetcher";

const URL1 = "https://shop.example.com/";

describe("timing phases", () => {
  it("reports DNS, connect, TLS, wait and download separately", () => {
    expect(phasesOf({ dnsMs: 12, connectMs: 32, tlsMs: 67, ttfbMs: 180, totalMs: 230 })).toEqual({ dnsMs: 12, connectMs: 20, tlsMs: 35, waitMs: 113, downloadMs: 50, ttfbMs: 180, totalMs: 230 });
    // A reused connection reports no DNS, connect or TLS: all of the TTFB is waiting.
    expect(phasesOf({ dnsMs: null, connectMs: null, tlsMs: null, ttfbMs: 90.6, totalMs: 120.2 })).toEqual({ dnsMs: null, connectMs: null, tlsMs: null, waitMs: 91, downloadMs: 29, ttfbMs: 91, totalMs: 120 });
  });

  it("turns the kit's times since the start into per-phase durations", () => {
    expect(phasesOf({ dnsMs: 40, connectMs: 90, tlsMs: 140, ttfbMs: 200, totalMs: 260 })).toMatchObject({ dnsMs: 40, connectMs: 50, tlsMs: 50, waitMs: 60, downloadMs: 60 });
    // A fast site: the marks add up to less than the TTFB, and must still be read as times since the start.
    expect(phasesOf({ dnsMs: 5, connectMs: 20, tlsMs: 40, ttfbMs: 120, totalMs: 130 })).toMatchObject({ dnsMs: 5, connectMs: 15, tlsMs: 20, waitMs: 80, downloadMs: 10 });
    // Plain http has no TLS mark; an IP address has no DNS mark.
    expect(phasesOf({ dnsMs: null, connectMs: 8, tlsMs: null, ttfbMs: 50, totalMs: 60 })).toMatchObject({ dnsMs: null, connectMs: 8, tlsMs: null, waitMs: 42 });
  });
});

describe("a check", () => {
  it("measures 3 runs one at a time, 500 ms apart, and reports the median and every run", async () => {
    const m = mockFetcher([{ timings: { ttfbMs: 300, totalMs: 340 } }, { timings: { ttfbMs: 120, totalMs: 150 } }, { timings: { ttfbMs: 200, totalMs: 260 } }]);
    const r = await run({ url: URL1 }, m);
    expect(m.calls.map((c) => [c.url, c.opts.method, c.opts.timeoutMs, c.opts.headers?.["accept-encoding"]])).toEqual([
      [URL1, "GET", 10000, "gzip, deflate, br"],
      [URL1, "GET", 10000, "gzip, deflate, br"],
      [URL1, "GET", 10000, "gzip, deflate, br"],
    ]);
    expect(m.sleeps).toEqual([500, 500]);
    expect(r.runs.map((x) => (x.ok ? x.phases.ttfbMs : null))).toEqual([300, 120, 200]);
    expect(r.median).toMatchObject({ ttfbMs: 200, totalMs: 260, dnsMs: 12 });
    expect(r.rating).toBe("good");
    expect(r.location).toBe(TEST_LOCATION);
    expect(median([5, 1, 3, 2])).toBe(3);
    expect(DataSchema.parse(r)).toBeTruthy();
  });

  it("rates against Google's thresholds and names the source", () => {
    expect([rate(120), rate(800), rate(801), rate(1800), rate(1801)]).toEqual(["good", "good", "needs-improvement", "needs-improvement", "poor"]);
    expect(THRESHOLD_SOURCE.url).toBe("https://web.dev/articles/ttfb");
  });

  it("does not follow redirects: it reports them and measures only the typed URL", async () => {
    const m = mockFetcher([{ status: 301, headers: { location: "/en/", server: "nginx" } }]);
    const r = await run({ url: "http://example.org/" }, m);
    expect(m.calls).toHaveLength(3);
    expect(new Set(m.calls.map((c) => c.url))).toEqual(new Set(["http://example.org/"]));
    expect(r.redirect).toEqual({ status: 301, location: "http://example.org/en/" });
    expect(r.suggestions.some((s) => s.text.includes("plain http://"))).toBe(true);
    expect(reportText(r)).toContain("redirects (301) to http://example.org/en/");
  });

  it("keeps going after a timed-out run, and fails clearly when nothing answers", async () => {
    const partial = mockFetcher([{ error: "timeout" }, { timings: { ttfbMs: 900, totalMs: 950 } }, { timings: { ttfbMs: 1000, totalMs: 1100 } }]);
    const r = await run({ url: URL1 }, partial);
    expect(r.runs[0]).toMatchObject({ ok: false, code: "timeout", message: "The server did not answer within 10 seconds." });
    expect(r.median?.ttfbMs).toBe(950);
    expect(r.rating).toBe("needs-improvement");

    await expect(run({ url: URL1 }, mockFetcher([{ error: "timeout" }]))).rejects.toMatchObject({ code: "timeout" });
    const dead = mockFetcher([{ error: "network" }]);
    await expect(run({ url: URL1 }, dead)).rejects.toBeInstanceOf(MeasureError);
    expect(dead.calls).toHaveLength(1);
    await expect(run({ url: URL1 }, mockFetcher([{ error: "blocked_host" }]))).rejects.toMatchObject({ code: "blocked_host" });
  });

  it("handles IPv6 addresses and reads HTTP/2 or HTTP/3, cache and Server-Timing hints", async () => {
    const m = mockFetcher([
      {
        remoteIp: "2606:4700:10::6816:d583",
        headers: { "alt-svc": 'h3=":443"; ma=86400', "cf-cache-status": "MISS", "server-timing": 'db;dur=412.4;desc="Database", app;dur=88', "content-type": "text/html", server: "cloudflare" },
        timings: { ttfbMs: 1450, totalMs: 1500, dnsMs: 5, connectMs: 10, tlsMs: 20 },
      },
    ]);
    const r = await run({ url: "https://[2606:4700:10::6816:d583]/" }, m);
    expect(r.ipVersion).toBe(6);
    expect(ipVersion("203.0.113.9")).toBe(4);
    expect(r.protocolHint).toContain("HTTP/3");
    expect(protocolHint({ "alt-svc": ['h2=":443"'] })).toBe("The server advertises HTTP/2 (alt-svc).");
    expect(r.cache).toBe("Cloudflare cache: MISS");
    expect(cacheStatus({ age: ["120"] })).toBe("Served from a cache (age 120 s)");
    expect(r.serverTiming).toEqual([
      { name: "db", durMs: 412.4, desc: "Database" },
      { name: "app", durMs: 88, desc: null },
    ]);
    expect(parseServerTiming(["bad name;dur=1"])).toEqual([]);
    expect(r.suggestions.map((s) => s.phase)).toEqual(["wait", "wait"]);
  });
});

describe("input and the route", () => {
  it("normalizes URLs and refuses private, local and odd-port addresses", () => {
    expect(normalizeUrl("example.com")).toEqual({ ok: true, url: "https://example.com/" });
    expect(normalizeUrl("https://[2606:4700:4700::1111]/")).toEqual({ ok: true, url: "https://[2606:4700:4700::1111]/" });
    for (const bad of ["http://localhost:3000", "https://10.0.0.5/", "https://[::1]/", "https://[fd00::1]/", "https://192.168.1.1", "https://intranet/", "https://example.com:8443/", "ftp://example.com", "https://user:pw@example.com/"]) {
      expect(normalizeUrl(bad).ok, bad).toBe(false);
    }
    expect(normalizeUrl("https://example.com/" + "a".repeat(2100))).toMatchObject({ ok: false });
  });

  it("validates the request before any outbound call and answers with the contract", async () => {
    const post = (body: string) => POST(new Request("http://localhost/api/tools/ttfb-server-response-time-test", { method: "POST", body, headers: { "content-type": "application/json" } }));
    const a = await post("not json");
    expect(a.status).toBe(400);
    expect(await a.json()).toEqual({ ok: false, error: { code: "invalid_input", message: "The request was not valid JSON." } });
    const b = await post(JSON.stringify({ url: "" }));
    expect(await b.json()).toMatchObject({ ok: false, error: { code: "invalid_input", message: "Enter a URL to test." } });
    const c = await post(JSON.stringify({ url: "http://127.0.0.1/admin" }));
    expect(c.status).toBe(400);
    expect((await c.json()).error.message).toContain("private or local network");
    expect(c.headers.get("cache-control")).toBe("no-store");
  });

  it("exports a text report and a CSV of the runs", async () => {
    const r = await run({ url: URL1 }, mockFetcher([{}, { error: "timeout" }, {}]));
    const text = reportText(r);
    expect(text).toContain("Median of 2 runs: TTFB 180 ms (Good), total 230 ms");
    expect(text).toContain("DNS 12 ms · connect 20 ms · TLS 35 ms · wait 113 ms · download 50 ms");
    expect(text).toContain("Run 2: The server did not answer within 10 seconds.");
    expect(runsCsv(r).split("\r\n")).toEqual([
      "run,status,dns_ms,connect_ms,tls_ms,wait_ms,download_ms,ttfb_ms,total_ms,bytes,error",
      "1,200,12,20,35,113,50,180,230,32,",
      '2,,,,,,,,,,"The server did not answer within 10 seconds."',
      "3,200,12,20,35,113,50,180,230,32,",
      "",
    ]);
  });
});
