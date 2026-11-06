import { rateLimit } from "@/lib/tools/rate-limit";
import { safeFetch } from "@/lib/tools/safe-fetch";
import { run } from "../logic/check";
import { normalizeEntry } from "../logic/parse";
import { RequestSchema, type ApiResponse } from "./schema";

// One call = one batch of up to 5 URLs, so 30 calls cover six 25-URL checks or three 50-URL checks.
const LIMIT = { bucket: "bulk-url-status-code-checker", limit: 30, windowSec: 600 };

function reply(body: ApiResponse, status: number, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}

const fail = (status: number, code: string, message: string, headers?: Record<string, string>) => reply({ ok: false, error: { code, message } }, status, headers);

export async function POST(req: Request): Promise<Response> {
  const limit = await rateLimit(req, LIMIT);
  if (!limit.ok) {
    return fail(429, "rate_limited", `You have checked ${LIMIT.limit} batches (${LIMIT.limit * 5} URLs) in the last 10 minutes. Try again in ${Math.max(1, Math.ceil(limit.retryAfterSec / 60))} minute(s).`, { "retry-after": String(limit.retryAfterSec) });
  }
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail(400, "invalid_input", "The request was not valid JSON.");
  }
  const parsed = RequestSchema.safeParse(json);
  if (!parsed.success) return fail(400, "invalid_input", parsed.error.issues[0]?.message ?? "Invalid input.");
  // The page already cleans the list; the route checks again because anyone can call it.
  const urls: string[] = [];
  for (const raw of parsed.data.urls) {
    const n = normalizeEntry(raw);
    if ("error" in n) return fail(400, "invalid_input", `${raw.slice(0, 100)}: ${n.error}`);
    urls.push(n.url);
  }
  try {
    const data = await run({ urls, followRedirects: parsed.data.followRedirects, headFirst: parsed.data.headFirst }, { fetcher: safeFetch });
    return reply({ ok: true, data }, 200);
  } catch {
    return fail(500, "internal", "Something went wrong on our side. Please try again.");
  }
}
