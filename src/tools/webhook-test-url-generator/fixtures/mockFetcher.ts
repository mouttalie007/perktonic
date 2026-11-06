import type { safeFetch } from "@/lib/tools/safe-fetch";
import { SafeFetchError } from "@/lib/tools/safe-fetch";

/** A fake safeFetch: records calls and answers with a fixed response (or throws a SafeFetchError). */
export function mockFetcher(answer: { status: number; body?: string; headers?: Record<string, string[]> } | SafeFetchError) {
  const calls: { url: string; opts: Parameters<typeof safeFetch>[1] }[] = [];
  const fn = (async (url, opts) => {
    calls.push({ url, opts });
    if (answer instanceof SafeFetchError) throw answer;
    return { url, status: answer.status, headers: answer.headers ?? { "content-type": ["text/plain"] }, body: new TextEncoder().encode(answer.body ?? ""), truncated: false, timings: { dnsMs: null, connectMs: null, tlsMs: null, ttfbMs: 12, totalMs: 20 }, remoteIp: null };
  }) as typeof safeFetch & { calls: typeof calls };
  fn.calls = calls;
  return fn;
}
