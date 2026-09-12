import "server-only";
import { headers } from "next/headers";
import { createHash } from "node:crypto";

/**
 * Best-effort client IP for rate-limiting Server Actions (which, unlike
 * Route Handlers, don't get a `request` object). Reads the reverse proxy's
 * `x-forwarded-for` (set by nginx in production, per the VPS deploy plan);
 * falls back to a constant in local dev where nothing sets it, which just
 * means every dev request shares one rate-limit bucket — fine for a form
 * you can only test as one person locally.
 */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}

/** SHA-256 hash of an IP — never store the raw address. */
export function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}
