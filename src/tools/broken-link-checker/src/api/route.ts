import { rateLimit } from "@/lib/tools/rate-limit";
import { safeFetch } from "@/lib/tools/safe-fetch";
import { CrawlError, crawl } from "../logic/crawl";
import { RATE_LIMIT, type CrawlEvent } from "../logic/types";
import { normalizeStart } from "../logic/url";
import { RequestSchema, type ApiError } from "./schema";

const fail = (status: number, code: string, message: string, headers: Record<string, string> = {}) => Response.json({ ok: false, error: { code, message } } satisfies ApiError, { status, headers: { "cache-control": "no-store", ...headers } });

/**
 * Validates and rate-limits like every tool route, then streams NDJSON: one
 * progress object per line, and a final {"type":"done"} or {"type":"error"}.
 * When the visitor cancels (the connection closes), the crawl is aborted.
 */
export async function POST(req: Request): Promise<Response> {
  // Heavy tool: one crawl can make up to 300 requests.
  const limit = await rateLimit(req, RATE_LIMIT);
  if (!limit.ok) {
    const minutes = Math.max(1, Math.ceil(limit.retryAfterSec / 60));
    return fail(429, "rate_limited", `You have started ${RATE_LIMIT.limit} crawls in the last 10 minutes. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`, { "retry-after": String(limit.retryAfterSec) });
  }
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail(400, "invalid_input", "The request was not valid JSON.");
  }
  const parsed = RequestSchema.safeParse(json);
  if (!parsed.success) return fail(400, "invalid_input", parsed.error.issues[0]?.message ?? "Invalid input.");
  const { url, ...options } = parsed.data;
  const start = normalizeStart(url);
  if (!start.ok) return fail(400, "invalid_input", start.error);

  const ctrl = new AbortController();
  req.signal.addEventListener("abort", () => ctrl.abort());
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (e: CrawlEvent) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        } catch {
          open = false;
          ctrl.abort();
        }
      };
      try {
        const data = await crawl({ url, options }, { fetcher: safeFetch, signal: ctrl.signal }, send);
        send({ type: "done", data });
      } catch (err) {
        if (err instanceof CrawlError) send({ type: "error", code: err.code, message: err.message });
        else send({ type: "error", code: "internal", message: "Something went wrong on our side. Please try again." });
      } finally {
        if (open) controller.close();
        open = false;
      }
    },
    cancel() {
      ctrl.abort();
    },
  });
  return new Response(stream, { status: 200, headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" } });
}
