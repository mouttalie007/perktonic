import { SafeFetchError, type SafeFetchOptions, type SafeResponse } from "@/lib/tools/safe-fetch";

export interface FakeFile {
  status: number;
  headers?: Record<string, string>;
  body?: string | Uint8Array;
  error?: SafeFetchError["code"];
}

/** safeFetch stand-in answering from a URL table; like the real one it keeps at most `maxBytes` and flags `truncated`. */
export function mockFetcher(files: Record<string, FakeFile>) {
  const calls: string[] = [];
  const fetcher = async (url: string, opts: SafeFetchOptions = {}): Promise<SafeResponse> => {
    calls.push(url);
    const f = files[url];
    if (!f) throw new SafeFetchError("network", "Could not connect to that site.");
    if (f.error) throw new SafeFetchError(f.error, "fixture error");
    const full = typeof f.body === "string" ? new TextEncoder().encode(f.body) : (f.body ?? new Uint8Array());
    const max = opts.maxBytes ?? 2_000_000;
    const headers: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(f.headers ?? {})) headers[k.toLowerCase()] = [v];
    return { url, status: f.status, headers, body: full.subarray(0, max), truncated: full.length > max, timings: { dnsMs: null, connectMs: null, tlsMs: null, ttfbMs: 20, totalMs: 30 }, remoteIp: null };
  };
  return { fetcher, calls };
}
