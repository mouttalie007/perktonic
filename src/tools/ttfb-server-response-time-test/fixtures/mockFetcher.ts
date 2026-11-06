import { SafeFetchError, type SafeFetchOptions, type SafeResponse, type Timings } from "@/lib/tools/safe-fetch";

export interface FakeRun {
  status?: number;
  headers?: Record<string, string | string[]>;
  body?: string;
  timings?: Partial<Timings>;
  remoteIp?: string | null;
  error?: SafeFetchError["code"];
}

/** Stands in for safeFetch: answers each call with the next scripted run, so tests never touch the network. */
export function mockFetcher(script: FakeRun[]) {
  const calls: { url: string; opts: SafeFetchOptions }[] = [];
  const fetcher = async (url: string, opts: SafeFetchOptions = {}): Promise<SafeResponse> => {
    const step = script[Math.min(calls.length, script.length - 1)];
    calls.push({ url, opts });
    if (step.error) throw new SafeFetchError(step.error, "fixture error");
    const headers: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(step.headers ?? {})) headers[k.toLowerCase()] = Array.isArray(v) ? v : [v];
    return {
      url,
      status: step.status ?? 200,
      headers,
      body: new TextEncoder().encode(step.body ?? "<!doctype html><title>ok</title>"),
      truncated: false,
      timings: { dnsMs: 12, connectMs: 32, tlsMs: 67, ttfbMs: 180, totalMs: 230, ...step.timings },
      remoteIp: step.remoteIp === undefined ? "93.184.215.14" : step.remoteIp,
    };
  };
  const sleeps: number[] = [];
  const sleep = async (ms: number) => {
    sleeps.push(ms);
  };
  return { fetcher, calls, sleep, sleeps, now: () => new Date("2026-11-01T12:00:00Z") };
}
