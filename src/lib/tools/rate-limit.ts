/**
 * Per-IP rate limit for the tool APIs: fixed window kept in memory (one Node
 * process on the VPS). Every bucket (one per tool) counts separately.
 * Skipped in `next dev` so you can test freely; set TOOLS_RATE_LIMIT_DEV=1 to test it locally.
 */
export interface RateLimitConfig {
  bucket: string;
  limit: number;
  windowSec: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

type Entry = { count: number; resetAt: number };
const store = new Map<string, Entry>();
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, v] of store) if (v.resetAt <= now) store.delete(k);
}

/** Pure counter, easy to test. */
export function hit(key: string, cfg: RateLimitConfig, now = Date.now()): RateLimitResult {
  sweep(now);
  const k = `${cfg.bucket}:${key}`;
  let e = store.get(k);
  if (!e || e.resetAt <= now) {
    e = { count: 0, resetAt: now + cfg.windowSec * 1000 };
    store.set(k, e);
  }
  if (e.count >= cfg.limit) {
    return { ok: false, remaining: 0, retryAfterSec: Math.max(1, Math.ceil((e.resetAt - now) / 1000)) };
  }
  e.count += 1;
  return { ok: true, remaining: cfg.limit - e.count, retryAfterSec: 0 };
}

export function clientIpOf(req: Request): string {
  // The reverse proxy (Caddy) sets x-forwarded-for; the first entry is the visitor.
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function rateLimit(req: Request, cfg: RateLimitConfig): Promise<RateLimitResult> {
  if (process.env.NODE_ENV === "development" && process.env.TOOLS_RATE_LIMIT_DEV !== "1") {
    return { ok: true, remaining: cfg.limit, retryAfterSec: 0 };
  }
  return hit(clientIpOf(req), cfg);
}

/** Test helper. */
export function resetRateLimits() {
  store.clear();
}
