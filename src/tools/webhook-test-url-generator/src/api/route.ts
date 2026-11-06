// JSON actions: create, list, extend, clear, delete, report, reply, replay.
import { rateLimit } from "@/lib/tools/rate-limit";
import { safeFetch } from "@/lib/tools/safe-fetch";
import { CREATE_LIMIT, MAX_ACTIVE_PER_IP, MAX_EXTENSIONS, READ_LIMIT, REPLAY_LIMIT, SLUG, WRITE_LIMIT } from "../limits";
import { senderIp } from "../logic/capture";
import { getStore } from "../logic/memoryStore";
import { replay } from "../logic/replay";
import type { CaptureStore } from "../logic/store";
import { RequestSchema } from "./schema";

const reply = (body: unknown, status = 200, headers: Record<string, string> = {}) => Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
const fail = (status: number, code: string, message: string, headers?: Record<string, string>) => reply({ ok: false, error: { code, message } }, status, headers);
const GONE = "This test URL does not exist or has expired. Create a new one.";

export interface RouteDeps {
  store: CaptureStore;
  fetcher: typeof safeFetch;
}

export async function handle(req: Request, deps: RouteDeps = { store: getStore(), fetcher: safeFetch }): Promise<Response> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail(400, "invalid_input", "The request was not valid JSON.");
  }
  const parsed = RequestSchema.safeParse(json);
  if (!parsed.success) return fail(400, "invalid_input", parsed.error.issues[0]?.message ?? "Invalid input.");
  const input = parsed.data;
  const cfg = input.action === "create" ? CREATE_LIMIT : input.action === "replay" ? REPLAY_LIMIT : input.action === "list" ? READ_LIMIT : WRITE_LIMIT;
  const limit = await rateLimit(req, { bucket: `${SLUG}:${input.action === "list" ? "read" : input.action === "create" || input.action === "replay" ? input.action : "write"}`, ...cfg });
  if (!limit.ok) {
    const minutes = Math.max(1, Math.ceil(limit.retryAfterSec / 60));
    return fail(429, "rate_limited", `Too many requests. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`, { "retry-after": String(limit.retryAfterSec) });
  }
  const { store } = deps;
  switch (input.action) {
    case "create": {
      const r = store.create(senderIp([["x-forwarded-for", req.headers.get("x-forwarded-for") ?? ""]]) ?? "unknown");
      if (!r.ok) return r.code === "too_many_for_ip" ? fail(429, "too_many_endpoints", `You already have ${MAX_ACTIVE_PER_IP} active test URLs. Delete one or wait until one expires.`) : fail(503, "full", "The request catcher is full right now. Please try again in a few minutes.");
      return reply({ ok: true, data: r.endpoint });
    }
    case "list": {
      const e = store.get(input.id);
      return e ? reply({ ok: true, data: e }) : fail(404, "not_found", GONE);
    }
    case "extend": {
      const r = store.extend(input.id);
      if (!r.ok) return r.code === "not_found" ? fail(404, "not_found", GONE) : fail(400, "no_more_extensions", `A test URL can be extended ${MAX_EXTENSIONS} times. Create a new one.`);
      return reply({ ok: true, data: r.endpoint });
    }
    case "clear":
      return store.clear(input.id) ? reply({ ok: true, data: store.get(input.id) }) : fail(404, "not_found", GONE);
    case "delete":
    case "report":
      // A report deletes the endpoint at once: ids are unguessable, so only someone who has the URL can do it.
      store.remove(input.id);
      return reply({ ok: true, data: { deleted: true } });
    case "reply": {
      const e = store.setReply(input.id, input.reply);
      return e ? reply({ ok: true, data: e }) : fail(404, "not_found", GONE);
    }
    case "replay": {
      const c = store.findRequest(input.id, input.requestId);
      if (!c) return fail(404, "not_found", "That captured request is no longer stored.");
      const r = await replay(c, input.url, { fetcher: deps.fetcher });
      return r.ok ? reply({ ok: true, data: r.data }) : fail(r.status, r.code, r.message);
    }
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    return await handle(req);
  } catch {
    return fail(500, "internal", "Something went wrong on our side. Please try again.");
  }
}
