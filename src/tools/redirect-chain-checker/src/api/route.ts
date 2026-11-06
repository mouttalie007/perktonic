import { rateLimit } from "@/lib/tools/rate-limit";
import { safeFetch } from "@/lib/tools/safe-fetch";
import { analyzeChain } from "../logic/analyze";
import { ChainError, run } from "../logic/chain";
import { normalizeUrl } from "../logic/url";
import { RequestSchema, type ApiResponse } from "./schema";

// Each check can make up to 11 outbound requests, so this counts as a heavy tool.
const LIMIT = { bucket: "redirect-chain-checker", limit: 10, windowSec: 600 };

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
  try {
    const result = await run({ url: url.url, userAgent: parsed.data.userAgent }, { fetcher: safeFetch });
    return reply({ ok: true, data: { ...result, ...analyzeChain(result) } }, 200);
  } catch (err) {
    if (err instanceof ChainError) {
      return fail(err.code === "invalid_url" || err.code === "blocked_host" ? 400 : 502, err.code, err.message);
    }
    return fail(500, "internal", "Something went wrong on our side. Please try again.");
  }
}
