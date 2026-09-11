import "server-only";

/**
 * Minimal in-memory rate limiter for public forms (spec §57, §88). Fine for
 * a single-instance deploy; move to a shared store (Redis) if scaled out to
 * multiple processes/instances.
 */
export function createRateLimiter(maxAttempts: number, windowMs: number) {
  const attempts = new Map<string, { count: number; resetAt: number }>();

  return {
    isLimited(key: string): boolean {
      const entry = attempts.get(key);
      if (!entry || Date.now() > entry.resetAt) return false;
      return entry.count >= maxAttempts;
    },
    record(key: string): void {
      const entry = attempts.get(key);
      if (!entry || Date.now() > entry.resetAt) {
        attempts.set(key, { count: 1, resetAt: Date.now() + windowMs });
        return;
      }
      entry.count += 1;
    },
    clear(key: string): void {
      attempts.delete(key);
    },
  };
}
