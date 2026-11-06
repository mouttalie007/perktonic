// The ping URLs. They answer at once with "ok" (cron jobs and scripts only need a 2xx).
import { rateLimit } from "@/lib/tools/rate-limit";
import { FAIL_BODY_BYTES, PING_LIMIT, SLUG } from "../limits";
import type { Deps } from "../logic/alerts";
import { getDeps } from "../logic/deps";
import { recordPing, type PingKind } from "../logic/pings";
import { isToken, sha256 } from "../logic/tokens";

const text = (status: number, body: string) => new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });

async function readMessage(req: Request): Promise<string | null> {
  if (req.method !== "POST" || !req.body) return null;
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < FAIL_BODY_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
  }
  await reader.cancel().catch(() => {});
  const all = new Uint8Array(size);
  let off = 0;
  for (const c of chunks) {
    all.set(c, off);
    off += c.length;
  }
  return new TextDecoder("utf-8").decode(all.subarray(0, FAIL_BODY_BYTES)).trim().slice(0, FAIL_BODY_BYTES) || null;
}

/** GET, POST and HEAD on …/ping/<token>, …/ping/<token>/fail and …/ping/<token>/start. */
export async function handlePing(req: Request, token: string, kind: PingKind = "success", deps?: Deps): Promise<Response> {
  if (!["GET", "POST", "HEAD"].includes(req.method)) return text(405, "Use GET, POST or HEAD.\n");
  if (!isToken(token)) return text(404, "Unknown ping URL.\n");
  // Ping flood protection: 60 per minute per ping URL.
  const limit = await rateLimit(req, { bucket: `${SLUG}:ping:${(await sha256(token)).slice(0, 16)}`, ...PING_LIMIT });
  if (!limit.ok) return text(429, "Too many pings for this URL (60 per minute).\n");
  const d = deps ?? getDeps(new URL(req.url).origin);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const message = kind === "fail" ? await readMessage(req) : null;
  const r = await recordPing(token, kind, { message, ip }, d);
  if (r === "unknown") return text(404, "Unknown ping URL. The monitor may have been deleted.\n");
  return text(200, req.method === "HEAD" ? "" : "ok\n");
}
