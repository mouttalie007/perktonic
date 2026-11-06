// Replay goes ONLY through safeFetch (SSRF protection). safeFetch sends GET and HEAD requests
// without a body, so only those methods can be replayed in v1; others are copied as cURL.
import type { safeFetch } from "@/lib/tools/safe-fetch";
import { SafeFetchError } from "@/lib/tools/safe-fetch";
import type { Captured, ReplayResult } from "../types";

const HOP_BY_HOP = /^(host|connection|keep-alive|proxy-.*|te|trailer|transfer-encoding|upgrade|content-length)$/i;

export function replayHeaders(c: Captured): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of c.headers) if (!HOP_BY_HOP.test(k) && !/^user-agent$/i.test(k)) out[k.toLowerCase()] = v;
  return out;
}

export type ReplayOutcome = { ok: true; data: ReplayResult } | { ok: false; code: string; message: string; status: number };

export async function replay(c: Captured, target: string, deps: { fetcher: typeof safeFetch }): Promise<ReplayOutcome> {
  if (c.method !== "GET" && c.method !== "HEAD") return { ok: false, code: "method_not_supported", status: 400, message: `Replay sends GET and HEAD requests only in this version. For this ${c.method} request, use Copy as cURL and run it yourself.` };
  try {
    const r = await deps.fetcher(target, { method: c.method, headers: replayHeaders(c), timeoutMs: 10_000, maxBytes: 64 * 1024, userAgent: c.headers.find(([k]) => /^user-agent$/i.test(k))?.[1] });
    const headers = Object.entries(r.headers).flatMap(([k, vs]) => vs.map((v) => [k, v] as [string, string]));
    return { ok: true, data: { status: r.status, headers, body: new TextDecoder("utf-8").decode(r.body), truncated: r.truncated, totalMs: r.timings.totalMs } };
  } catch (e) {
    if (e instanceof SafeFetchError) return { ok: false, code: e.code, status: e.code === "invalid_url" || e.code === "blocked_host" ? 400 : 502, message: e.message };
    return { ok: false, code: "network", status: 502, message: "Could not reach that address." };
  }
}
