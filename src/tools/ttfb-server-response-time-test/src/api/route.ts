import { rateLimit } from "@/lib/tools/rate-limit";
import { safeFetch } from "@/lib/tools/safe-fetch";
import { MeasureError, run } from "../logic/measure";
import { RATE_LIMIT } from "../logic/types";
import { normalizeUrl } from "../logic/url";
import { RequestSchema, type ApiResponse } from "./schema";

function reply(body: ApiResponse, status: number, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}

const fail = (status: number, code: string, message: string, headers?: Record<string, string>) => reply({ ok: false, error: { code, message } }, status, headers);

export async function POST(req: Request): Promise<Response> {
  // Heavy tool: each check makes up to 3 outbound requests.
  const limit = await rateLimit(req, RATE_LIMIT);
  if (!limit.ok) {
    const minutes = Math.max(1, Math.ceil(limit.retryAfterSec / 60));
    return fail(429, "rate_limited", `You have run ${RATE_LIMIT.limit} tests in the last 10 minutes. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`, { "retry-after": String(limit.retryAfterSec) });
  }
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail(400, "invalid_input", "The request was not valid JSON.");
  }
  const parsed = RequestSchema.safeParse(json);
  if (!parsed.success) return fail(400, "invalid_input", parsed.error.issues[0]?.message ?? "Invalid input.");
  const url = normalizeUrl(parsed.data.url);
  if (!url.ok) return fail(400, "invalid_input", url.error);
  try {
    const data = await run({ url: url.url }, { fetcher: safeFetch });
    return reply({ ok: true, data }, 200);
  } catch (err) {
    if (err instanceof MeasureError) return fail(err.code === "invalid_url" || err.code === "blocked_host" ? 400 : 502, err.code, err.message);
    return fail(500, "internal", "Something went wrong on our side. Please try again.");
  }
}
