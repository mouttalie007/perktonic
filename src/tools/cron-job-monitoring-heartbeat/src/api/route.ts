// JSON actions: create, config, view, pause, resume, test, delete, confirm, stop.
import { rateLimit } from "@/lib/tools/rate-limit";
import { ACTION_LIMIT, CREATE_LIMIT, SLUG } from "../limits";
import type { Deps } from "../logic/alerts";
import { getDeps } from "../logic/deps";
import { byManage, confirmEmail, createMonitor, deleteMonitor, setPaused, stopEmail, testAlert, view } from "../logic/service";
import { RequestSchema } from "./schema";

const reply = (body: unknown, status = 200, headers: Record<string, string> = {}) => Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
const fail = (status: number, code: string, message: string, headers?: Record<string, string>) => reply({ ok: false, error: { code, message } }, status, headers);
type Out = { ok: true; data: unknown } | { ok: false; code: string; message: string; status: number };
const send = (r: Out) => (r.ok ? reply({ ok: true, data: r.data }) : fail(r.status, r.code, r.message));

export async function handle(req: Request, deps?: Deps): Promise<Response> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail(400, "invalid_input", "The request was not valid JSON.");
  }
  const parsed = RequestSchema.safeParse(json);
  if (!parsed.success) return fail(400, "invalid_input", parsed.error.issues[0]?.message ?? "Invalid input.");
  const input = parsed.data;
  const limit = await rateLimit(req, input.action === "create" ? { bucket: `${SLUG}:create`, ...CREATE_LIMIT } : { bucket: SLUG, ...ACTION_LIMIT });
  if (!limit.ok) return fail(429, "rate_limited", input.action === "create" ? "You can create 3 monitors per day. Try again tomorrow." : "Too many requests. Try again in a few minutes.", { "retry-after": String(limit.retryAfterSec) });
  const d = deps ?? getDeps(new URL(req.url).origin);
  switch (input.action) {
    case "create": {
      const r = await createMonitor({ ...input, emails: [...new Set(input.emails.map((e) => e.toLowerCase()))] }, d);
      return r.ok ? reply({ ok: true, data: { pingToken: r.pingToken, manageToken: r.manageToken, monitor: r.monitor } }) : fail(r.status, r.code, r.message);
    }
    case "config":
      return reply({ ok: true, data: { telegram: d.notifier.telegramConfigured() } });
    case "view": {
      const m = await byManage(input.manage, d);
      return m ? reply({ ok: true, data: await view(m, d) }) : fail(404, "not_found", "This dashboard link is not valid, or the monitor was deleted.");
    }
    case "pause":
    case "resume":
      return send(await setPaused(input.manage, input.action === "pause", d));
    case "test":
      return send(await testAlert(input.manage, d));
    case "delete":
      return send(await deleteMonitor(input.manage, d));
    case "confirm":
      return send(await confirmEmail(input.token, d));
    case "stop":
      return send(await stopEmail(input.token, d));
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    return await handle(req);
  } catch {
    return fail(500, "internal", "Something went wrong on our side. Please try again.");
  }
}
