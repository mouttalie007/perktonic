import { SafeFetchError, type SafeFetchOptions, type SafeResponse } from "@/lib/tools/safe-fetch";

/** An invented shop at demo-shop.example (a reserved name), built to contain every kind of problem the crawler reports. */
export const ORIGIN = "https://demo-shop.example";
const html = (title: string, body: string) => `<!doctype html><html><head><title>${title}</title></head><body>${body}</body></html>`;

export interface Page {
  status: number;
  body?: string;
  headers?: Record<string, string>;
  /** Status for HEAD requests when it differs (405 = HEAD not allowed). */
  head?: number;
  error?: SafeFetchError["code"];
}

export const SITE: Record<string, Page> = {
  [`${ORIGIN}/robots.txt`]: { status: 200, body: "User-agent: *\nDisallow: /\n\nUser-agent: PerkTonicBot\nDisallow: /cart\nDisallow: /admin/\nAllow: /\n", headers: { "content-type": "text/plain" } },
  [`${ORIGIN}/`]: {
    status: 200,
    body: html(
      "Demo Shop",
      `<a href="#main">Skip</a>
       <img src="/img/logo.png" alt="Demo Shop logo">
       <nav><a href="/about">About us</a> <a href="/blog/">Blog</a> <a href="/cart">Cart</a> <a href="/admin/">Admin</a></nav>
       <a href="/products?page=1">Products</a> <a href="/products?page=2">2</a> <a href="/products?page=3">3</a> <a href="/products?page=4">4</a>
       <a href="mailto:hello@demo-shop.example">Email us</a> <a href="tel:+441234567890">Call</a> <a href="javascript:void(0)">Menu</a>
       <a href="https://partner.example/ok">Our partner</a>
       <a href="https://partner.example/gone">Spring offer</a>
       <a href="https://partner.example/moved">Size guide</a>
       <a href="https://partner.example/no-head">Returns policy</a>
       <a href="https://old-partner.example/">Old supplier</a>
       <a href="https://slow.example/">Shipping tracker</a>
       <img src="/img/missing-banner.jpg" alt="Autumn sale banner">`,
    ),
    headers: { "content-type": "text/html; charset=utf-8" },
  },
  [`${ORIGIN}/about`]: { status: 200, body: html("About", `<a href="/team">Meet the team</a> <a href="/about/history">Our history</a> <a href="/">Home</a>`), headers: { "content-type": "text/html" } },
  [`${ORIGIN}/team`]: { status: 200, body: html("Team", `<a href="/team/ada">Ada</a> <a href="/team/grace">Grace</a>`), headers: { "content-type": "text/html" } },
  [`${ORIGIN}/team/ada`]: { status: 200, headers: { "content-type": "text/html" } },
  [`${ORIGIN}/team/grace`]: { status: 404, headers: { "content-type": "text/html" } },
  [`${ORIGIN}/about/history`]: { status: 404, body: html("Not found", "Not found"), headers: { "content-type": "text/html" } },
  [`${ORIGIN}/blog/`]: { status: 301, headers: { location: "/blog" } },
  [`${ORIGIN}/blog`]: { status: 200, body: html("Blog", `<a href="/blog/new-autumn-range">New autumn range</a> <a href="/blog/2019-sale">2019 sale</a> <img src="/img/logo.png" alt="logo">`), headers: { "content-type": "text/html" } },
  [`${ORIGIN}/blog/new-autumn-range`]: { status: 200, body: html("Post", `<a href="/products?page=1">Shop now</a>`), headers: { "content-type": "text/html" } },
  [`${ORIGIN}/blog/2019-sale`]: { status: 500, headers: { "content-type": "text/html" } },
  [`${ORIGIN}/products?page=1`]: { status: 200, body: html("Products", `<a href="/products?page=2">Next</a>`), headers: { "content-type": "text/html" } },
  [`${ORIGIN}/products?page=2`]: { status: 200, body: html("Products", `<a href="/products?page=3">Next</a>`), headers: { "content-type": "text/html" } },
  [`${ORIGIN}/products?page=3`]: { status: 200, body: html("Products", `<a href="/products?page=4">Next</a>`), headers: { "content-type": "text/html" } },
  [`${ORIGIN}/img/logo.png`]: { status: 200, headers: { "content-type": "image/png" } },
  [`${ORIGIN}/img/missing-banner.jpg`]: { status: 404, headers: { "content-type": "text/html" } },
  "https://partner.example/ok": { status: 200, headers: { "content-type": "text/html" } },
  "https://partner.example/gone": { status: 404, headers: { "content-type": "text/html" } },
  "https://partner.example/moved": { status: 301, headers: { location: "https://partner.example/size-guide" } },
  "https://partner.example/no-head": { status: 200, head: 405, headers: { "content-type": "text/html" } },
  "https://old-partner.example/": { status: 0, error: "network" },
  "https://slow.example/": { status: 0, error: "timeout" },
};

export interface Call {
  url: string;
  method: string;
  at: number;
  userAgent: string | undefined;
}

/**
 * A fake clock: sleep() waits for simulated time, which jumps to the next timer
 * only once every pending promise has settled, so tests are fast and exact.
 */
export function fakeClock() {
  let t = 0;
  const timers: { at: number; resolve: () => void }[] = [];
  let pumping = false;
  const pump = () => {
    pumping = false;
    if (!timers.length) return;
    timers.sort((a, b) => a.at - b.at);
    t = Math.max(t, timers[0].at);
    while (timers.length && timers[0].at <= t) timers.shift()!.resolve();
    schedule();
  };
  const schedule = () => {
    if (pumping) return;
    pumping = true;
    setImmediate(pump);
  };
  const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      timers.push({ at: t + Math.max(0, ms), resolve });
      schedule();
    });
  return { now: () => t, sleep };
}

/** safeFetch stand-in answering from SITE on the fake clock (each request takes 40 ms). */
export function mockSite(site: Record<string, Page> = SITE) {
  const clock = fakeClock();
  const calls: Call[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const fetcher = async (url: string, opts: SafeFetchOptions = {}): Promise<SafeResponse> => {
    const method = opts.method ?? "GET";
    calls.push({ url, method, at: clock.now(), userAgent: opts.userAgent });
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await clock.sleep(40);
    inFlight--;
    const page = site[url];
    if (!page) return { url, status: 404, headers: { "content-type": ["text/html"] }, body: new Uint8Array(), truncated: false, timings: { dnsMs: null, connectMs: null, tlsMs: null, ttfbMs: 40, totalMs: 40 }, remoteIp: null };
    if (page.error) throw new SafeFetchError(page.error, page.error);
    const headers: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(page.headers ?? {})) headers[k] = [v];
    const status = method === "HEAD" && page.head ? page.head : page.status;
    const body = method === "HEAD" ? new Uint8Array() : new TextEncoder().encode(page.body ?? "");
    return { url, status, headers, body, truncated: false, timings: { dnsMs: null, connectMs: null, tlsMs: null, ttfbMs: 40, totalMs: 40 }, remoteIp: null };
  };
  return { fetcher, calls, sleep: clock.sleep, now: clock.now, maxInFlight: () => maxInFlight };
}
