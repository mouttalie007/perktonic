import type { SafeFetchOptions, SafeResponse, Timings } from "@/lib/tools/safe-fetch";
import { ipVersion } from "./url";
import { GAP_MS, RUNS, TEST_LOCATION, TIMEOUT_MS, rate, type Phases, type Result, type Run, type Suggestion } from "./types";

export interface Deps {
  fetcher: (url: string, opts?: SafeFetchOptions) => Promise<SafeResponse>;
  /** Injected so tests do not wait for real time. */
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
}

/** Ask like a browser does, so servers answer with the same compression and content a visitor gets. */
const BROWSER_HEADERS = { accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "accept-encoding": "gzip, deflate, br" };

export class MeasureError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const MESSAGES: Record<string, string> = {
  invalid_url: "That does not look like a URL the tester can open.",
  blocked_host: "That address is on a private or reserved network, so the tester cannot reach it.",
  timeout: `The server did not answer within ${TIMEOUT_MS / 1000} seconds.`,
  too_large: "The response was larger than the tester accepts.",
  network: "Could not connect to that site. Check the address; the domain may not exist or may refuse connections.",
  too_many_redirects: "Too many redirects.",
};

function errorCode(e: unknown): string {
  const code = (e as { code?: unknown })?.code;
  return typeof code === "string" && code in MESSAGES ? code : "network";
}

/**
 * Splits safeFetch timings into the five phases. The kit reports dnsMs, connectMs and
 * tlsMs as times since the request started, so each phase is the step from the previous
 * mark; wait is what remains of the TTFB once DNS, connect and TLS are taken out.
 */
export function phasesOf(t: Timings): Phases {
  const r = (v: number | null) => (v === null ? null : Math.max(0, Math.round(v)));
  const ttfb = r(t.ttfbMs) ?? 0;
  const total = Math.max(ttfb, r(t.totalMs) ?? 0);
  let prev = 0;
  const step = (v: number | null) => {
    const mark = r(v);
    if (mark === null) return null;
    const d = Math.max(0, mark - prev);
    prev = Math.max(prev, mark);
    return d;
  };
  const dns = step(t.dnsMs);
  const connect = step(t.connectMs);
  const tls = step(t.tlsMs);
  const before = (dns ?? 0) + (connect ?? 0) + (tls ?? 0);
  return {
    dnsMs: dns,
    connectMs: connect,
    tlsMs: tls,
    waitMs: Math.max(0, ttfb - before),
    downloadMs: total - ttfb,
    ttfbMs: ttfb,
    totalMs: total,
  };
}

export function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/** Median of each phase over the successful runs; a phase is null only if no run reported it. */
export function medianPhases(list: Phases[]): Phases | null {
  if (list.length === 0) return null;
  const pick = (k: "dnsMs" | "connectMs" | "tlsMs") => {
    const v = list.map((p) => p[k]).filter((x): x is number => x !== null);
    return v.length ? median(v) : null;
  };
  return {
    dnsMs: pick("dnsMs"),
    connectMs: pick("connectMs"),
    tlsMs: pick("tlsMs"),
    waitMs: median(list.map((p) => p.waitMs)),
    downloadMs: median(list.map((p) => p.downloadMs)),
    ttfbMs: median(list.map((p) => p.ttfbMs)),
    totalMs: median(list.map((p) => p.totalMs)),
  };
}

const first = (h: Record<string, string[]>, name: string) => h[name]?.[0] ?? null;

/** Server-Timing: name;dur=12.3;desc="DB", other;dur=4 */
export function parseServerTiming(values: string[]): Result["serverTiming"] {
  const out: Result["serverTiming"] = [];
  for (const entry of values.join(",").split(",")) {
    const [name, ...params] = entry.split(";").map((s) => s.trim());
    if (!name || !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name)) continue;
    let durMs: number | null = null;
    let desc: string | null = null;
    for (const p of params) {
      const m = /^(dur|desc)\s*=\s*(?:"([^"]*)"|([^\s"]*))$/i.exec(p);
      if (!m) continue;
      const v = m[2] ?? m[3];
      if (m[1].toLowerCase() === "dur" && Number.isFinite(Number(v))) durMs = Math.round(Number(v) * 10) / 10;
      else if (m[1].toLowerCase() === "desc") desc = v.slice(0, 80);
    }
    out.push({ name: name.slice(0, 40), durMs, desc });
    if (out.length >= 20) break;
  }
  return out;
}

/** What the CDN or cache headers say about this response, in words. */
export function cacheStatus(h: Record<string, string[]>): string | null {
  const named: [string, string][] = [
    ["cf-cache-status", "Cloudflare"],
    ["x-vercel-cache", "Vercel"],
    ["x-nf-cache-status", "Netlify"],
    ["x-cache", "CDN"],
    ["x-proxy-cache", "proxy"],
    ["x-litespeed-cache", "LiteSpeed"],
  ];
  for (const [header, who] of named) {
    const v = first(h, header);
    if (v) return `${who} cache: ${v.slice(0, 60)}`;
  }
  const age = first(h, "age");
  if (age && /^\d+$/.test(age)) return `Served from a cache (age ${age} s)`;
  return null;
}

/** Hints about HTTP/2 and HTTP/3 that the response headers reveal. */
export function protocolHint(h: Record<string, string[]>): string | null {
  const altSvc = (h["alt-svc"] ?? []).join(",");
  if (/\bh3(-\d+)?=/.test(altSvc)) return "The server advertises HTTP/3 (alt-svc), so browsers that support it may connect faster than this test.";
  if (/\bh2=/.test(altSvc)) return "The server advertises HTTP/2 (alt-svc).";
  return null;
}

export function suggestionsFor(m: Phases, ctx: { compression: string | null; cache: string | null; contentType: string | null; spread: number; https: boolean; bytes: number }): Suggestion[] {
  const s: Suggestion[] = [];
  if (m.dnsMs !== null && m.dnsMs > 100) s.push({ phase: "dns", text: `DNS took ${m.dnsMs} ms. A faster DNS provider (or one with servers near your visitors) and longer TTLs on your records cut this for first-time visitors.` });
  if (m.connectMs !== null && m.connectMs > 150) s.push({ phase: "connect", text: `Connecting took ${m.connectMs} ms, which usually means the server is far from the test location. A CDN puts a server near each visitor.` });
  if (m.tlsMs !== null && m.tlsMs > 200) s.push({ phase: "tls", text: `The TLS handshake took ${m.tlsMs} ms. Enable TLS 1.3, session resumption and OCSP stapling, and keep the certificate chain short.` });
  if (m.waitMs > 600) {
    s.push({ phase: "wait", text: `The server spent ${m.waitMs} ms before answering. That is time spent generating the page: cache full pages or fragments, check slow database queries, and avoid calls to other services before the first byte.${ctx.cache ? "" : " No cache header was seen, so the page is probably built for every request."}` });
  }
  if (ctx.cache && /miss|expired|bypass|dynamic/i.test(ctx.cache)) s.push({ phase: "wait", text: `The response was not served from the cache (${ctx.cache}), so the origin server built it. If the page can be cached, a cache rule, a longer cache lifetime or cache warming lowers TTFB.` });
  if (m.downloadMs > 500) s.push({ phase: "download", text: `Downloading the body took ${m.downloadMs} ms. Make the HTML smaller or stream it, so the browser can start loading other files sooner.` });
  if (!ctx.compression && ctx.bytes > 10_000 && ctx.contentType && /text|json|javascript|xml/i.test(ctx.contentType)) s.push({ phase: "download", text: `The ${Math.round(ctx.bytes / 1024)} KB response was not compressed. Enable Brotli or gzip on the server or CDN.` });
  if (ctx.spread > 2) s.push({ phase: "general", text: "The three runs differ a lot. Uneven times usually mean a cold cache on the first request, or a server that is busy or scaling up." });
  if (!ctx.https) s.push({ phase: "general", text: "This URL uses plain http://. Most visitors are sent to https://, so test the https:// address as well." });
  if (s.length === 0) s.push({ phase: "general", text: "Nothing stands out: every phase is within the usual range for a single, uncached request from one location." });
  return s;
}

/**
 * Measures the URL RUNS times, one request at a time and GAP_MS apart, without
 * following redirects: at most RUNS outbound requests per check.
 */
export async function run(input: { url: string }, deps: Deps): Promise<Result> {
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const runs: Run[] = [];
  let firstOk: SafeResponse | null = null;
  for (let n = 1; n <= RUNS; n++) {
    if (n > 1) await sleep(GAP_MS);
    try {
      const res = await deps.fetcher(input.url, { method: "GET", timeoutMs: TIMEOUT_MS, maxBytes: 2_000_000, headers: BROWSER_HEADERS });
      firstOk ??= res;
      runs.push({ n, ok: true, status: res.status, phases: phasesOf(res.timings), bytes: res.body.length, truncated: res.truncated });
    } catch (e) {
      const code = errorCode(e);
      // A URL that cannot be fetched at all will not work on the next tries either.
      if (n === 1 && code !== "timeout") throw new MeasureError(code, MESSAGES[code]);
      runs.push({ n, ok: false, code, message: MESSAGES[code] });
    }
  }
  if (!firstOk) throw new MeasureError("timeout", `${MESSAGES.timeout} All ${RUNS} tries timed out.`);

  const okRuns = runs.filter((r): r is Extract<Run, { ok: true }> => r.ok);
  const m = medianPhases(okRuns.map((r) => r.phases));
  const h = firstOk.headers;
  const location = first(h, "location");
  const redirect = firstOk.status >= 300 && firstOk.status < 400 && location ? { status: firstOk.status, location: safeResolve(location, firstOk.url) } : null;
  const compression = first(h, "content-encoding");
  const cache = cacheStatus(h);
  const ttfbs = okRuns.map((r) => r.phases.ttfbMs);
  const spread = ttfbs.length > 1 ? Math.max(...ttfbs) / Math.max(1, Math.min(...ttfbs)) : 1;
  return {
    url: input.url,
    location: TEST_LOCATION,
    runs,
    median: m,
    rating: m ? rate(m.ttfbMs) : null,
    status: firstOk.status,
    redirect,
    remoteIp: firstOk.remoteIp,
    ipVersion: ipVersion(firstOk.remoteIp),
    server: first(h, "server")?.slice(0, 80) ?? null,
    protocolHint: protocolHint(h),
    cache,
    compression,
    serverTiming: parseServerTiming(h["server-timing"] ?? []),
    suggestions: m ? suggestionsFor(m, { compression, cache, contentType: first(h, "content-type"), spread, https: input.url.startsWith("https:"), bytes: firstOk.body.length }) : [],
    measuredAt: (deps.now ?? (() => new Date()))().toISOString(),
  };
}

function safeResolve(location: string, base: string): string {
  try {
    return new URL(location, base).toString();
  } catch {
    return location;
  }
}
