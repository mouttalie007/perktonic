import { rateLimit } from "@/lib/tools/rate-limit";
import { safeFetch } from "@/lib/tools/safe-fetch";
import { run, siteOrigin } from "../logic/run";
import { RequestSchema, type ApiResponse } from "./schema";

// One check can make up to about a dozen outbound requests (robots.txt and 5 sitemaps, with redirects), so this is a heavy tool.
const LIMIT = { bucket: "robots-txt-tester-and-sitemap-validator", limit: 10, windowSec: 600 };

function reply(body: ApiResponse, status: number, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}

const fail = (status: number, code: string, message: string, headers?: Record<string, string>) => reply({ ok: false, error: { code, message } }, status, headers);

export async function POST(req: Request): Promise<Response> {
  const limit = await rateLimit(req, LIMIT);
  if (!limit.ok) {
    return fail(429, "rate_limited", `You have run ${LIMIT.limit} checks in the last 10 minutes. Try again in ${Math.max(1, Math.ceil(limit.retryAfterSec / 60))} minute(s). Testing more URLs against a robots.txt you already loaded does not count.`, { "retry-after": String(limit.retryAfterSec) });
  }
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail(400, "invalid_input", "The request was not valid JSON.");
  }
  const parsed = RequestSchema.safeParse(json);
  if (!parsed.success) return fail(400, "invalid_input", parsed.error.issues[0]?.message ?? "Invalid input.");
  const origin = siteOrigin(parsed.data.domain);
  if (!origin.ok) return fail(400, "invalid_input", origin.error);
  try {
    const data = await run({ origin: origin.origin, urls: parsed.data.urls, userAgents: parsed.data.userAgents }, { fetcher: safeFetch });
    return reply({ ok: true, data }, 200);
  } catch {
    return fail(500, "internal", "Something went wrong on our side. Please try again.");
  }
}
