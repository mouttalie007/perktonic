import { SafeFetchError, type safeFetch, type SafeResponse } from "@/lib/tools/safe-fetch";

export const MAX_REDIRECTS = 10;
import { MAX_CUSTOM_HEADERS } from "./limits";
export { MAX_CUSTOM_HEADERS };
/** When HEAD is refused we fall back to GET but only read this much of the body. */
export const GET_BODY_CAP = 64 * 1024;

// Statuses that usually mean "this server does not like HEAD", not "this page is broken".
const HEAD_REFUSED = new Set([400, 403, 404, 405, 501]);

// Headers the visitor may not set: they are controlled by the HTTP client or would change how the request is routed.
const FORBIDDEN = /^(host|content-length|connection|transfer-encoding|upgrade|te|trailer|keep-alive|expect|proxy-.*|via|forwarded|x-forwarded-.*)$/i;

export interface CustomHeader {
  name: string;
  value: string;
}

export type HeaderCheck = { ok: true; headers: Record<string, string> } | { ok: false; error: string };

export function validateCustomHeaders(list: CustomHeader[]): HeaderCheck {
  const rows = list.filter((h) => h.name.trim() !== "" || h.value.trim() !== "");
  if (rows.length > MAX_CUSTOM_HEADERS) return { ok: false, error: `You can add up to ${MAX_CUSTOM_HEADERS} request headers.` };
  const out: Record<string, string> = {};
  for (const h of rows) {
    const name = h.name.trim();
    if (!/^[A-Za-z0-9!#$%&'*+.^_`|~-]{1,64}$/.test(name)) return { ok: false, error: `“${name || "(empty)"}” is not a valid header name. Use letters, digits and dashes, e.g. Accept-Language.` };
    if (FORBIDDEN.test(name)) return { ok: false, error: `The ${name} header cannot be set here; the HTTP client controls it.` };
    if (/[\r\n\0]/.test(h.value) || h.value.length > 1024) return { ok: false, error: `The value of ${name} must be one line of at most 1,024 characters.` };
    out[name.toLowerCase()] = h.value.trim();
  }
  return { ok: true, headers: out };
}

export interface RedirectStep {
  url: string;
  status: number;
  location: string;
}

export interface FetchResult {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  method: "HEAD" | "GET";
  /** Why GET was used although HEAD was asked for, if it was. */
  fallback: string | null;
  headers: Record<string, string[]>;
  redirects: RedirectStep[];
  ttfbMs: number;
  totalMs: number;
}

export interface RunInput {
  url: string;
  method: "HEAD" | "GET";
  followRedirects: boolean;
  headers: Record<string, string>;
}

export interface Deps {
  fetcher: typeof safeFetch;
}

export class AnalyzerError extends Error {
  constructor(
    public readonly code: SafeFetchError["code"],
    message: string,
  ) {
    super(message);
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function friendlyError(err: unknown, url: string): AnalyzerError {
  if (!(err instanceof SafeFetchError)) return new AnalyzerError("network", "Something went wrong while contacting the site.");
  const host = hostOf(url);
  const messages: Record<SafeFetchError["code"], string> = {
    invalid_url: "That URL cannot be checked. Use a plain http:// or https:// address without a user name or password.",
    blocked_host: `${host} points to a private, local or reserved network address, so the analyzer does not visit it.`,
    timeout: `${host} did not answer within 10 seconds.`,
    too_large: `${host} sent a response that is too large.`,
    network: `Could not connect to ${host}. Check the spelling, or the site may be down.`,
    too_many_redirects: `${host} redirected more than ${MAX_REDIRECTS} times.`,
  };
  return new AnalyzerError(err.code, messages[err.code]);
}

/**
 * Requests the URL (HEAD by default) through the kit's safeFetch, following
 * redirects one hop at a time. If a server refuses HEAD (405, 501, and the
 * 400/403/404 some CDNs send) or drops the connection, the same URL is
 * requested again with GET and only the first 64 KB of the body is read.
 */
export async function run(input: RunInput, deps: Deps): Promise<FetchResult> {
  const requestHeaders = { "accept-encoding": "br, gzip, deflate", accept: "text/html,application/xhtml+xml,*/*;q=0.8", ...input.headers };
  const redirects: RedirectStep[] = [];
  let method = input.method;
  let fallback: string | null = null;
  let current = input.url;

  for (let hop = 0; ; hop++) {
    let res: SafeResponse;
    try {
      res = await deps.fetcher(current, { method, headers: requestHeaders, maxBytes: method === "GET" ? GET_BODY_CAP : 1024, timeoutMs: 10_000 });
      if (method === "HEAD" && HEAD_REFUSED.has(res.status)) {
        const retry = await deps.fetcher(current, { method: "GET", headers: requestHeaders, maxBytes: GET_BODY_CAP, timeoutMs: 10_000 });
        if (retry.status !== res.status) {
          fallback = `The server answered HEAD with ${res.status}, so GET was used (first 64 KB of the body only).`;
          method = "GET";
          res = retry;
        }
      }
    } catch (err) {
      if (method === "HEAD" && err instanceof SafeFetchError && (err.code === "network" || err.code === "timeout")) {
        try {
          res = await deps.fetcher(current, { method: "GET", headers: requestHeaders, maxBytes: GET_BODY_CAP, timeoutMs: 10_000 });
        } catch (err2) {
          throw friendlyError(err2, current);
        }
        fallback = "The server did not answer the HEAD request, so GET was used (first 64 KB of the body only).";
        method = "GET";
      } else {
        throw friendlyError(err, current);
      }
    }
    const loc = res.headers["location"]?.[0];
    if (input.followRedirects && res.status >= 300 && res.status <= 399 && loc) {
      const next = new URL(loc, res.url).toString();
      redirects.push({ url: res.url, status: res.status, location: next });
      if (hop >= MAX_REDIRECTS - 1) throw new AnalyzerError("too_many_redirects", `${hostOf(input.url)} redirected more than ${MAX_REDIRECTS} times.`);
      if (redirects.some((r) => r.url === next)) throw new AnalyzerError("too_many_redirects", `Redirect loop: ${next} redirects back to a URL already visited.`);
      current = next;
      continue;
    }
    return {
      requestedUrl: input.url,
      finalUrl: res.url,
      status: res.status,
      method,
      fallback,
      headers: res.headers,
      redirects,
      ttfbMs: res.timings.ttfbMs,
      totalMs: res.timings.totalMs,
    };
  }
}
