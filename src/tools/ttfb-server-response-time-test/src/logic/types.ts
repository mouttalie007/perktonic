// No imports: shared by the page (browser) and the route (server).

export const MAX_URL_LENGTH = 2048;
export const RUNS = 3;
export const GAP_MS = 500;
export const TIMEOUT_MS = 10_000;
export const RATE_LIMIT = { bucket: "ttfb-server-response-time-test", limit: 10, windowSec: 600 };

/**
 * Where the requests come from. The Integrator can replace the wording with the
 * real region (for example "Frankfurt, Germany") once the hosting is known.
 */
export const TEST_LOCATION = "the perktonic.com server (one location)";

/** Google's TTFB guidance: good at 0.8 s or less, poor above 1.8 s (75th percentile of real visits). */
export const THRESHOLDS = { goodMs: 800, poorMs: 1800 };
export const THRESHOLD_SOURCE = { title: "web.dev: Time to First Byte (TTFB)", url: "https://web.dev/articles/ttfb" };

export type Rating = "good" | "needs-improvement" | "poor";

export function rate(ttfbMs: number): Rating {
  if (ttfbMs <= THRESHOLDS.goodMs) return "good";
  if (ttfbMs <= THRESHOLDS.poorMs) return "needs-improvement";
  return "poor";
}

export const RATING_LABEL: Record<Rating, string> = { good: "Good", "needs-improvement": "Needs improvement", poor: "Poor" };

export interface Phases {
  /** null when the measuring client did not report it (for example a reused connection). */
  dnsMs: number | null;
  connectMs: number | null;
  tlsMs: number | null;
  /** Time from the request being sent to the first byte: TTFB minus DNS, connect and TLS. */
  waitMs: number;
  /** total − ttfb */
  downloadMs: number;
  ttfbMs: number;
  totalMs: number;
}

export type Run =
  | { n: number; ok: true; status: number; phases: Phases; bytes: number; truncated: boolean }
  | { n: number; ok: false; code: string; message: string };

export interface Suggestion {
  phase: "dns" | "connect" | "tls" | "wait" | "download" | "general";
  text: string;
}

export interface Result {
  url: string;
  location: string;
  runs: Run[];
  median: Phases | null;
  rating: Rating | null;
  status: number | null;
  redirect: { status: number; location: string } | null;
  remoteIp: string | null;
  ipVersion: 4 | 6 | null;
  server: string | null;
  protocolHint: string | null;
  cache: string | null;
  compression: string | null;
  serverTiming: { name: string; durMs: number | null; desc: string | null }[];
  suggestions: Suggestion[];
  measuredAt: string;
}
