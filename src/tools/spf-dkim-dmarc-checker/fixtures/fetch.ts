import { SafeFetchError, type SafeFetchOptions, type SafeResponse } from "@/lib/tools/safe-fetch";
import { MTA_STS_POLICY } from "./zones";

/** safeFetch stand-in for the MTA-STS policy files; records the calls. */
export function mockFetcher(table: Record<string, { status: number; body?: string; headers?: Record<string, string> }> = HTTP) {
  const calls: { url: string; opts: SafeFetchOptions }[] = [];
  const fetcher = async (url: string, opts: SafeFetchOptions = {}): Promise<SafeResponse> => {
    calls.push({ url, opts });
    const hit = table[url];
    if (!hit) throw new SafeFetchError("network", "Could not connect to that site.");
    const headers: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(hit.headers ?? {})) headers[k] = [v];
    return { url, status: hit.status, headers, body: new TextEncoder().encode(hit.body ?? ""), truncated: false, timings: { dnsMs: null, connectMs: null, tlsMs: null, ttfbMs: 30, totalMs: 32 }, remoteIp: null };
  };
  return { fetcher, calls };
}

export const HTTP = {
  "https://mta-sts.example.com/.well-known/mta-sts.txt": { status: 200, body: MTA_STS_POLICY, headers: { "content-type": "text/plain" } },
};
