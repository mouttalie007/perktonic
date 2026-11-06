// The capture URL (every method) and the live view (Server-Sent Events).
import { CAPTURES_PER_MINUTE, HEARTBEAT_MS } from "../limits";
import { BLOCKED_AGENTS, buildCapture, readCapped } from "../logic/capture";
import { isId, newId } from "../logic/ids";
import { getStore } from "../logic/memoryStore";
import type { CaptureStore, Clock } from "../logic/store";
import { systemClock } from "../logic/store";

export interface CaptureDeps {
  store: CaptureStore;
  clock: Clock;
  sleep: (ms: number) => Promise<void>;
}
const defaults = (): CaptureDeps => ({ store: getStore(), clock: systemClock, sleep: (ms) => new Promise((r) => setTimeout(r, ms)) });

const text = (status: number, body: string, extra: Record<string, string> = {}) => new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", ...extra } });
// The visitor chooses this response (it may be HTML): it is served sandboxed so it can never run as our site.
const SAFE = { "content-security-policy": "default-src 'none'; sandbox", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" };
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS", "access-control-allow-headers": "*", "access-control-max-age": "600" };

/** Accepts GET, POST, PUT, PATCH, DELETE, HEAD and OPTIONS on …/hook/<id>. */
export async function handleCapture(req: Request, id: string, deps: CaptureDeps = defaults()): Promise<Response> {
  if (!isId(id)) return text(404, "Unknown endpoint.\n");
  const ep = deps.store.get(id);
  if (!ep) return text(404, "This test URL does not exist or has expired.\n");
  if (BLOCKED_AGENTS.test(req.headers.get("user-agent") ?? "")) return text(403, "Forbidden.\n");
  if (!deps.store.hit(id)) return text(429, `This test URL accepts ${CAPTURES_PER_MINUTE} requests per minute. Try again shortly.\n`, { "retry-after": "60" });
  const { body, truncated, size } = await readCapped(req.method === "GET" || req.method === "HEAD" ? null : req.body);
  const headers: [string, string][] = [];
  req.headers.forEach((v, k) => headers.push([k, v]));
  deps.store.add(id, buildCapture({ method: req.method, url: req.url, headers, body, truncated, size }, newId(), new Date(deps.clock.now())));
  const r = ep.reply;
  if (r.delayMs > 0) await deps.sleep(r.delayMs);
  const noBody = req.method === "HEAD" || r.status === 204 || r.status === 205 || r.status === 304;
  return new Response(noBody ? null : r.body, { status: r.status, headers: { "content-type": `${r.contentType}; charset=utf-8`, "cache-control": "no-store", "x-request-catcher": "perktonic", ...SAFE, ...CORS } });
}

/** Live view: one `capture` event per new request, `cleared`, `updated`, `deleted`; a comment every 15 s. */
export function handleEvents(req: Request, id: string, deps: Pick<CaptureDeps, "store"> & { heartbeatMs?: number } = { store: getStore() }): Response {
  if (!isId(id) || !deps.store.get(id)) return text(404, "This test URL does not exist or has expired.\n");
  const enc = new TextEncoder();
  let stop = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      const send = (s: string) => {
        try {
          ctrl.enqueue(enc.encode(s));
        } catch {
          stop();
        }
      };
      send(`retry: 3000\n: connected\n\n`);
      const unsubscribe = deps.store.subscribe(id, (e) => {
        send(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`);
        if (e.type === "deleted") stop();
      });
      const beat = setInterval(() => send(`: ping\n\n`), deps.heartbeatMs ?? HEARTBEAT_MS);
      stop = () => {
        clearInterval(beat);
        unsubscribe();
        try {
          ctrl.close();
        } catch {
          // already closed
        }
      };
      req.signal.addEventListener("abort", () => stop());
    },
    cancel() {
      stop();
    },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store, no-transform", connection: "keep-alive", "x-accel-buffering": "no" } });
}
