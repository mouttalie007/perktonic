import { SafeFetchError, type safeFetch, type SafeResponse } from "@/lib/tools/safe-fetch";
import { findClientRedirects, type ClientRedirect } from "./clientRedirects";
import { USER_AGENTS, type UserAgentId } from "./userAgents";

export const MAX_REDIRECTS = 10;
const HOP_BODY_BYTES = 256 * 1024;

export type RedirectKind = "permanent" | "temporary" | "none";

export interface HopResult {
  index: number;
  url: string;
  status: number;
  statusText: string;
  kind: RedirectKind;
  location: string | null;
  /** The Location header exactly as the server sent it. */
  locationRaw: string | null;
  relativeLocation: boolean;
  ms: number;
  ttfbMs: number;
  server: string | null;
}

export interface Stop {
  reason: "loop" | "too_many_redirects" | "error";
  message: string;
  url: string;
}

export interface ChainResult {
  startUrl: string;
  finalUrl: string;
  hops: HopResult[];
  redirectCount: number;
  totalMs: number;
  stop: Stop | null;
  clientRedirects: ClientRedirect[];
  userAgent: UserAgentId;
}

export interface RunInput {
  url: string;
  userAgent: UserAgentId;
}

export interface Deps {
  fetcher: typeof safeFetch;
}

const STATUS_TEXT: Record<number, string> = {
  200: "OK", 201: "Created", 204: "No Content", 301: "Moved Permanently", 302: "Found", 303: "See Other",
  304: "Not Modified", 307: "Temporary Redirect", 308: "Permanent Redirect", 400: "Bad Request", 401: "Unauthorized",
  403: "Forbidden", 404: "Not Found", 405: "Method Not Allowed", 410: "Gone", 429: "Too Many Requests",
  451: "Unavailable For Legal Reasons", 500: "Internal Server Error", 502: "Bad Gateway", 503: "Service Unavailable", 504: "Gateway Timeout",
};

export function redirectKind(status: number): RedirectKind {
  if (status === 301 || status === 308) return "permanent";
  if (status === 302 || status === 303 || status === 307) return "temporary";
  return "none";
}

function first(headers: Record<string, string[]>, name: string): string | null {
  return headers[name]?.[0] ?? null;
}

/** A fetch failure with a message that is safe to show to the visitor. */
export class ChainError extends Error {
  constructor(
    public readonly code: SafeFetchError["code"],
    message: string,
  ) {
    super(message);
  }
}

export function friendlyFetchError(err: unknown, url: string): ChainError {
  if (err instanceof SafeFetchError) {
    const host = (() => {
      try {
        return new URL(url).host;
      } catch {
        return url;
      }
    })();
    const messages: Record<SafeFetchError["code"], string> = {
      invalid_url: "That URL cannot be checked. Use a plain http:// or https:// address without a user name or password.",
      blocked_host: `${host} points to a private, local or reserved network address, so the checker does not visit it.`,
      timeout: `${host} did not answer within 10 seconds.`,
      too_large: `${host} sent a response that is too large to check.`,
      network: `Could not connect to ${host}. Check the spelling, or the site may be down.`,
      too_many_redirects: "The site redirected more than 10 times.",
    };
    return new ChainError(err.code, messages[err.code]);
  }
  return new ChainError("network", "Something went wrong while contacting the site.");
}

function isHtml(res: SafeResponse): boolean {
  const type = first(res.headers, "content-type") ?? "";
  return /html/i.test(type) || (type === "" && /^\s*</.test(new TextDecoder().decode(res.body.subarray(0, 64))));
}

/**
 * Follows a URL one request at a time through the kit's safeFetch (redirects
 * are never followed automatically), so every hop is visible and timed and
 * loops are caught before the same URL is requested twice.
 */
export async function run(input: RunInput, deps: Deps): Promise<ChainResult> {
  const hops: HopResult[] = [];
  const visited = new Set<string>();
  let current = input.url;
  let stop: Stop | null = null;
  let last: SafeResponse | null = null;
  const userAgent = USER_AGENTS[input.userAgent].value;

  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    visited.add(current);
    let res: SafeResponse;
    try {
      res = await deps.fetcher(current, { method: "GET", maxBytes: HOP_BODY_BYTES, timeoutMs: 10_000, userAgent });
    } catch (err) {
      const e = friendlyFetchError(err, current);
      if (hops.length === 0) throw e;
      stop = { reason: "error", message: e.message, url: current };
      break;
    }
    last = res;
    const locationRaw = first(res.headers, "location");
    let location: string | null = null;
    if (locationRaw !== null) {
      try {
        location = new URL(locationRaw, res.url).toString();
      } catch {
        location = null;
      }
    }
    const isRedirect = res.status >= 300 && res.status <= 399 && location !== null;
    hops.push({
      index: hops.length + 1,
      url: res.url,
      status: res.status,
      statusText: STATUS_TEXT[res.status] ?? "",
      kind: isRedirect ? redirectKind(res.status) : "none",
      location: isRedirect ? location : null,
      locationRaw: isRedirect ? locationRaw : null,
      relativeLocation: isRedirect && locationRaw !== null && !/^[a-z][a-z0-9+.-]*:/i.test(locationRaw),
      ms: res.timings.totalMs,
      ttfbMs: res.timings.ttfbMs,
      server: first(res.headers, "server"),
    });
    if (!isRedirect || location === null) break;
    if (visited.has(location)) {
      stop = { reason: "loop", message: `Hop ${hops.length} redirects back to ${location}, which was already visited.`, url: location };
      break;
    }
    if (i === MAX_REDIRECTS) {
      stop = { reason: "too_many_redirects", message: `The chain was stopped after ${MAX_REDIRECTS} redirects; the next one would go to ${location}.`, url: location };
      break;
    }
    current = location;
  }

  const finalHop = hops[hops.length - 1];
  const clientRedirects = stop === null && last && finalHop.kind === "none" && isHtml(last) ? findClientRedirects(new TextDecoder().decode(last.body), last.url) : [];
  return {
    startUrl: input.url,
    finalUrl: finalHop.url,
    hops,
    redirectCount: hops.filter((h) => h.kind !== "none").length,
    totalMs: hops.reduce((sum, h) => sum + h.ms, 0),
    stop,
    clientRedirects,
    userAgent: input.userAgent,
  };
}
