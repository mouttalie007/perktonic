import { SafeFetchError, type SafeFetchOptions, type SafeResponse } from "@/lib/tools/safe-fetch";

export interface FakePage {
  status: number;
  headers?: Record<string, string | string[]>;
  body?: string | Uint8Array;
  error?: SafeFetchError["code"];
}

/** A stand-in for the kit's safeFetch that answers from a URL table and honours maxBytes, so tests never touch the network. */
export function mockFetcher(pages: Record<string, FakePage>) {
  const calls: { url: string; opts: SafeFetchOptions }[] = [];
  const fetcher = async (url: string, opts: SafeFetchOptions = {}): Promise<SafeResponse> => {
    calls.push({ url, opts });
    const page = pages[url];
    if (!page) throw new SafeFetchError("network", "Could not connect to that site.");
    if (page.error) throw new SafeFetchError(page.error, "fixture error");
    const headers: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(page.headers ?? {})) headers[k.toLowerCase()] = Array.isArray(v) ? v : [v];
    const body = typeof page.body === "string" ? new TextEncoder().encode(page.body) : page.body ?? new Uint8Array();
    const max = opts.maxBytes ?? 2_000_000;
    return {
      url,
      status: page.status,
      headers,
      body: body.subarray(0, max),
      truncated: body.length > max,
      timings: { dnsMs: null, connectMs: null, tlsMs: null, ttfbMs: 40, totalMs: 60 },
      remoteIp: null,
    };
  };
  return { fetcher, calls };
}
