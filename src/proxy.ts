import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Admin-managed URL redirects (the Redirect model, spec §38/§58). Proxy
 * defaults to the Node.js runtime in Next 16, so Prisma works directly here.
 *
 * Perf: this app is a single long-running Node process (not edge/serverless),
 * so an in-memory cache with a short TTL is safe and keeps the common case
 * (no redirect) at zero DB cost per request — only a table scan every
 * REFRESH_MS. If the DB is unreachable we fail open and let normal routing
 * continue rather than 500 every request.
 */

const REFRESH_MS = 60_000;
let cache: {
  map: Map<string, { toPath: string; statusCode: number }>;
  expires: number;
} | null = null;

async function getRedirectMap() {
  if (cache && Date.now() < cache.expires) return cache.map;
  const rows = await prisma.redirect.findMany({ where: { enabled: true } });
  const map = new Map(
    rows.map((r) => [r.fromPath, { toPath: r.toPath, statusCode: r.statusCode }]),
  );
  cache = { map, expires: Date.now() + REFRESH_MS };
  return map;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  try {
    const map = await getRedirectMap();
    const hit = map.get(pathname);
    if (hit) {
      const status = ([301, 302, 303, 307, 308] as const).includes(
        hit.statusCode as 301,
      )
        ? hit.statusCode
        : 301;
      return NextResponse.redirect(new URL(hit.toPath, request.url), status);
    }
  } catch {
    // DB unreachable at this instant — fail open.
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|icon|apple-icon|opengraph-image|twitter-image|sitemap.*\\.xml|robots\\.txt|feed\\.xml|ads\\.txt|.*\\.(?:png|jpg|jpeg|webp|avif|svg|ico|css|js|txt)$).*)",
  ],
};
