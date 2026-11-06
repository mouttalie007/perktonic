import { dnsQuery } from "@/lib/tools/dns-query";
import { rateLimit } from "@/lib/tools/rate-limit";
import { safeFetch } from "@/lib/tools/safe-fetch";
import { CheckError, run } from "../logic/check";
import { RATE_LIMIT } from "../logic/types";
import { RequestSchema, type ApiResponse } from "./schema";

function reply(body: ApiResponse, status: number, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}
const fail = (status: number, code: string, message: string, headers?: Record<string, string>) => reply({ ok: false, error: { code, message } }, status, headers);

export async function POST(req: Request): Promise<Response> {
  // Each check makes up to 40 DNS queries, so the limit is lower than the default.
  const limit = await rateLimit(req, RATE_LIMIT);
  if (!limit.ok) {
    const minutes = Math.max(1, Math.ceil(limit.retryAfterSec / 60));
    return fail(429, "rate_limited", `You have run ${RATE_LIMIT.limit} checks in the last 10 minutes. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`, { "retry-after": String(limit.retryAfterSec) });
  }
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail(400, "invalid_input", "The request was not valid JSON.");
  }
  const parsed = RequestSchema.safeParse(json);
  if (!parsed.success) return fail(400, "invalid_input", parsed.error.issues[0]?.message ?? "Invalid input.");
  try {
    const data = await run(parsed.data, { fetcher: safeFetch, dns: dnsQuery });
    return reply({ ok: true, data }, 200);
  } catch (err) {
    if (err instanceof CheckError) return fail(err.code === "invalid_input" ? 400 : 502, err.code, err.message);
    return fail(500, "internal", "Something went wrong on our side. Please try again.");
  }
}
