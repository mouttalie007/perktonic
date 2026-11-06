import { SafeFetchError, type SafeFetchOptions, type SafeResponse } from "@/lib/tools/safe-fetch";

export interface FakePage {
  status: number;
  headers?: Record<string, string | string[]>;
  body?: string;
  ms?: number;
  error?: SafeFetchError["code"];
}

/** A stand-in for the kit's safeFetch that answers from a URL → response table, so tests never touch the network. */
export function mockFetcher(pages: Record<string, FakePage>) {
  const calls: { url: string; opts: SafeFetchOptions }[] = [];
  const fetcher = async (url: string, opts: SafeFetchOptions = {}): Promise<SafeResponse> => {
    calls.push({ url, opts });
    const page = pages[url];
    if (!page) throw new SafeFetchError("network", "Could not connect to that site.");
    if (page.error) throw new SafeFetchError(page.error, "fixture error");
    const headers: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(page.headers ?? {})) headers[k.toLowerCase()] = Array.isArray(v) ? v : [v];
    const ms = page.ms ?? 40;
    return {
      url,
      status: page.status,
      headers,
      body: new TextEncoder().encode(page.body ?? ""),
      truncated: false,
      timings: { dnsMs: null, connectMs: null, tlsMs: null, ttfbMs: ms - 5, totalMs: ms },
      remoteIp: null,
    };
  };
  return { fetcher, calls };
}
