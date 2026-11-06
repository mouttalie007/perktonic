import { SafeFetchError, type SafeFetchOptions, type SafeResponse } from "@/lib/tools/safe-fetch";

export interface FakePage {
  status: number;
  headers?: Record<string, string>;
  /** Status returned to HEAD only, e.g. 405 for servers that do not support it. */
  headStatus?: number;
  error?: SafeFetchError["code"];
  ms?: number;
}

export interface Call {
  url: string;
  method: string;
  start: number;
  end: number;
  maxBytes?: number;
}

/**
 * A stand-in for safeFetch on a virtual clock: each request "takes" `ms`
 * (default 40) of virtual time, so ordering and gaps can be asserted without
 * real waiting.
 */
export function mockNetwork(pages: Record<string, FakePage>) {
  let clock = 0;
  const calls: Call[] = [];
  let active = 0;
  let maxActive = 0;
  const activeByHost = new Map<string, number>();
  let maxPerHost = 0;
  const now = () => clock;
  const sleep = async (ms: number) => {
    clock += ms;
  };
  const fetcher = async (url: string, opts: SafeFetchOptions = {}): Promise<SafeResponse> => {
    const host = new URL(url).hostname;
    const call: Call = { url, method: opts.method ?? "GET", start: clock, end: clock, maxBytes: opts.maxBytes };
    calls.push(call);
    active++;
    activeByHost.set(host, (activeByHost.get(host) ?? 0) + 1);
    maxActive = Math.max(maxActive, active);
    maxPerHost = Math.max(maxPerHost, activeByHost.get(host)!);
    // Yield a few times so other workers really run in between.
    for (let i = 0; i < 3; i++) await Promise.resolve();
    const page = pages[url];
    clock += page?.ms ?? 40;
    call.end = clock;
    active--;
    activeByHost.set(host, activeByHost.get(host)! - 1);
    if (!page) throw new SafeFetchError("network", "Could not connect to that site.");
    if (page.error) throw new SafeFetchError(page.error, "fixture error");
    const headers: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(page.headers ?? {})) headers[k.toLowerCase()] = [v];
    const status = opts.method === "HEAD" && page.headStatus !== undefined ? page.headStatus : page.status;
    return { url, status, headers, body: new Uint8Array(), truncated: false, timings: { dnsMs: null, connectMs: null, tlsMs: null, ttfbMs: 30, totalMs: page.ms ?? 40 }, remoteIp: null };
  };
  return { fetcher, now, sleep, calls, stats: () => ({ maxActive, maxPerHost }) };
}
