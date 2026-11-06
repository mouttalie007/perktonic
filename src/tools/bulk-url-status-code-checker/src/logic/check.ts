import type { SafeFetchOptions, SafeResponse } from "@/lib/tools/safe-fetch";
import { BATCH_BUDGET_MS, CONCURRENCY, HOST_GAP_MS, MAX_REDIRECTS } from "./limits";
import { statusText } from "./status";
import type { CheckOptions, CheckResult, ErrorCode } from "./types";

export type Fetcher = (url: string, opts?: SafeFetchOptions) => Promise<SafeResponse>;

export interface Deps {
  fetcher: Fetcher;
  /** Injected so tests can run on a virtual clock. */
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

/** HEAD answers that often mean "this server does not do HEAD properly", so the URL is asked again with GET. */
const HEAD_FALLBACK = new Set([400, 403, 404, 405, 406, 409, 410, 500, 501, 502, 503]);

const REASONS: Record<string, string> = {
  invalid_url: "Not a valid http(s) URL.",
  blocked_host: "This address is private or reserved, so it is not checked.",
  timeout: "No answer within 10 seconds.",
  too_large: "The response was too large.",
  network: "Could not connect (the domain may not exist, or the server refused the connection).",
  too_many_redirects: `More than ${MAX_REDIRECTS} redirects.`,
};

function errorCode(e: unknown): ErrorCode {
  const code = (e as { code?: unknown })?.code;
  return typeof code === "string" && code in REASONS ? (code as ErrorCode) : "network";
}

/**
 * Serializes requests per host: one at a time, at least HOST_GAP_MS apart,
 * so a list of 50 pages on one site never looks like a burst.
 */
export class HostScheduler {
  private tails = new Map<string, Promise<void>>();
  private last = new Map<string, number>();

  constructor(
    private now: () => number,
    private sleep: (ms: number) => Promise<void>,
  ) {}

  run<T>(url: string, task: () => Promise<T>): Promise<T> {
    const host = new URL(url).hostname.toLowerCase();
    const prev = this.tails.get(host) ?? Promise.resolve();
    const result = prev.then(async () => {
      const last = this.last.get(host);
      if (last !== undefined) {
        const wait = last + HOST_GAP_MS - this.now();
        if (wait > 0) await this.sleep(wait);
      }
      try {
        return await task();
      } finally {
        this.last.set(host, this.now());
      }
    });
    this.tails.set(
      host,
      result.then(
        () => undefined,
        () => undefined,
      ),
    );
    return result;
  }
}

function header(res: SafeResponse, name: string): string | null {
  return res.headers[name]?.[0] ?? null;
}

/** Request time only: waiting for a turn on a busy host is not part of a URL's response time. */
type Timer = { ms: number; now: () => number };

async function request(url: string, opts: CheckOptions, sched: HostScheduler, fetcher: Fetcher, timer: Timer): Promise<{ res: SafeResponse; method: "HEAD" | "GET" }> {
  const timed = (o: SafeFetchOptions) =>
    sched.run(url, async () => {
      const t0 = timer.now();
      try {
        return await fetcher(url, o);
      } finally {
        timer.ms += timer.now() - t0;
      }
    });
  // GET bodies are not needed, so keep them small; the status and headers arrive first.
  const get = () => timed({ method: "GET", maxBytes: 64 * 1024, timeoutMs: 10_000 });
  if (!opts.headFirst) return { res: await get(), method: "GET" };
  try {
    const head = await timed({ method: "HEAD", timeoutMs: 10_000 });
    if (!HEAD_FALLBACK.has(head.status)) return { res: head, method: "HEAD" };
  } catch (e) {
    // Some servers reset the connection on HEAD but answer GET; a timeout is not retried, to keep the batch fast.
    if (errorCode(e) !== "network") throw e;
  }
  return { res: await get(), method: "GET" };
}

/** Checks one URL, following redirects hop by hop when asked. Never throws: failures become a row with a reason. */
export async function checkUrl(url: string, opts: CheckOptions, sched: HostScheduler, deps: Required<Deps>): Promise<CheckResult> {
  const timer: Timer = { ms: 0, now: deps.now };
  const chain: number[] = [];
  let current = url;
  let last: SafeResponse | null = null;
  let method: "HEAD" | "GET" = opts.headFirst ? "HEAD" : "GET";
  const seen = new Set<string>([url]);
  const result = (error: CheckResult["error"], finalUrl: string | null): CheckResult => ({
    url,
    status: last?.status ?? null,
    statusText: last ? statusText(last.status) : "No response",
    finalUrl,
    redirects: Math.max(0, chain.length - 1),
    chain,
    timeMs: Math.round(timer.ms),
    contentType: last ? (header(last, "content-type")?.split(";")[0].trim() ?? null) : null,
    method,
    error,
  });
  try {
    for (let hop = 0; ; hop++) {
      const r = await request(current, opts, sched, deps.fetcher, timer);
      last = r.res;
      method = r.method;
      chain.push(r.res.status);
      const location = header(r.res, "location");
      const isRedirect = r.res.status >= 300 && r.res.status < 400 && location !== null;
      if (!isRedirect) return result(null, current);
      let target: string;
      try {
        target = new URL(location, current).toString();
      } catch {
        return result({ code: "invalid_url", message: `The redirect points to an invalid address (${location.slice(0, 200)}).` }, null);
      }
      if (!opts.followRedirects) return result(null, target);
      if (hop >= MAX_REDIRECTS) return result({ code: "too_many_redirects", message: REASONS.too_many_redirects }, target);
      if (seen.has(target)) return result({ code: "redirect_loop", message: `Redirect loop: ${target} was already visited.` }, target);
      if (!/^https?:$/.test(new URL(target).protocol)) return result({ code: "invalid_url", message: `The redirect goes to a non-web address (${new URL(target).protocol}).` }, target);
      seen.add(target);
      current = target;
    }
  } catch (e) {
    const code = errorCode(e);
    const where = current !== url ? ` (at ${current})` : "";
    return result({ code, message: REASONS[code] + where }, chain.length ? current : null);
  }
}

/** Checks one batch: up to CONCURRENCY URLs at a time, one request at a time per host, within a time budget. */
export async function run(input: { urls: string[] } & CheckOptions, deps: Deps): Promise<{ results: CheckResult[] }> {
  const full: Required<Deps> = {
    fetcher: deps.fetcher,
    now: deps.now ?? (() => performance.now()),
    sleep: deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))),
  };
  const sched = new HostScheduler(full.now, full.sleep);
  const opts: CheckOptions = { followRedirects: input.followRedirects, headFirst: input.headFirst };
  const started = full.now();
  const results: CheckResult[] = new Array(input.urls.length);
  let next = 0;
  const worker = async () => {
    while (next < input.urls.length) {
      const i = next++;
      const url = input.urls[i];
      if (full.now() - started > BATCH_BUDGET_MS) {
        results[i] = { url, status: null, statusText: "Not checked", finalUrl: null, redirects: 0, chain: [], timeMs: 0, contentType: null, method: opts.headFirst ? "HEAD" : "GET", error: { code: "skipped", message: "Skipped: this batch ran out of time because other URLs were slow. Check it again on its own." } };
        continue;
      }
      results[i] = await checkUrl(url, opts, sched, full);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, input.urls.length) }, worker));
  return { results };
}
