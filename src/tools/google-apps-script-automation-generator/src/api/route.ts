import { AI_LIMIT, callLlm } from "@/lib/tools/llm";
import { rateLimit } from "@/lib/tools/rate-limit";
import { LIMIT_TEXT, SLUG } from "../limits";
import { run } from "../llm/run";
import { RequestSchema, type ApiResponse } from "./schema";

function reply(body: ApiResponse, status: number, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}
const fail = (status: number, code: string, message: string, headers?: Record<string, string>) => reply({ ok: false, error: { code, message } }, status, headers);

const LLM_STATUS = { too_long: 413, quota: 429, invalid_output: 502, upstream: 502 } as const;
const CALM = "The AI service did not give a usable script this time. Please try again in a moment.";

export async function handle(req: Request, llm: typeof callLlm): Promise<Response> {
  const limit = await rateLimit(req, { bucket: SLUG, ...AI_LIMIT });
  if (!limit.ok) {
    const minutes = Math.max(1, Math.ceil(limit.retryAfterSec / 60));
    return fail(429, "rate_limited", `You have used the ${LIMIT_TEXT}. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`, { "retry-after": String(limit.retryAfterSec) });
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
    const out = await run(parsed.data, { llm });
    if (out.ok) return reply({ ok: true, data: out.data }, 200);
    // quota and too_long messages come from callLlm and are safe to show as they are.
    const message = out.code === "quota" || out.code === "too_long" ? out.message : CALM;
    return fail(LLM_STATUS[out.code], out.code, message);
  } catch {
    return fail(500, "internal", "Something went wrong on our side. Please try again.");
  }
}

export async function POST(req: Request): Promise<Response> {
  return handle(req, callLlm);
}
