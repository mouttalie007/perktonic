import { rateLimit } from "@/lib/tools/rate-limit";
import { safeFetch } from "@/lib/tools/safe-fetch";
import { analyze } from "../logic/analyze";
import { AnalyzerError, run, validateCustomHeaders } from "../logic/fetchHeaders";
import { normalizeUrl } from "../logic/url";
import { RequestSchema, type ApiResponse } from "./schema";

const LIMIT = { bucket: "http-response-header-analyzer", limit: 30, windowSec: 600 };

function reply(body: ApiResponse, status: number, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}

const fail = (status: number, code: string, message: string, headers?: Record<string, string>) => reply({ ok: false, error: { code, message } }, status, headers);

export async function POST(req: Request): Promise<Response> {
  const limit = await rateLimit(req, LIMIT);
  if (!limit.ok) {
    return fail(429, "rate_limited", `You have run ${LIMIT.limit} checks in the last 10 minutes. Try again in ${Math.ceil(limit.retryAfterSec / 60)} minute(s).`, { "retry-after": String(limit.retryAfterSec) });
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
  const headers = validateCustomHeaders(parsed.data.headers);
  if (!headers.ok) return fail(400, "invalid_input", headers.error);
  try {
    const result = await run({ url: url.url, method: parsed.data.method, followRedirects: parsed.data.followRedirects, headers: headers.headers }, { fetcher: safeFetch });
    return reply({ ok: true, data: { ...result, ...analyze(result) } }, 200);
  } catch (err) {
    if (err instanceof AnalyzerError) return fail(err.code === "invalid_url" || err.code === "blocked_host" ? 400 : 502, err.code, err.message);
    return fail(500, "internal", "Something went wrong on our side. Please try again.");
  }
}
