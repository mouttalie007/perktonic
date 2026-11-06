// …/ping/<token> (success), …/ping/<token>/fail and …/ping/<token>/start.
import { MIN_RECORD_GAP_SEC } from "../limits";
import type { Monitor } from "../types";
import { transition, type Deps } from "./alerts";
import { evaluate } from "./evaluate";
import { sha256 } from "./tokens";

export type PingKind = "success" | "fail" | "start";

export async function recordPing(token: string, kind: PingKind, info: { message: string | null; ip: string | null }, d: Deps): Promise<"ok" | "unknown" | "ignored"> {
  const m = await d.store.findByPingHash(await sha256(token));
  if (!m) return "unknown";
  const now = d.clock.now();
  const at = new Date(now).toISOString();
  const last = [m.lastPingAt, m.lastStartAt, m.failedAt].filter((x): x is string => !!x).map(Date.parse);
  // Flood protection: a ping within 10 s of the previous one is answered but not recorded.
  if (last.length && now - Math.max(...last) < MIN_RECORD_GAP_SEC * 1000) return "ignored";
  let next: Monitor = { ...m };
  if (kind === "start") {
    next.lastStartAt = at;
    await d.store.recordPing(m.id, { at, kind, durationMs: null, message: null, ip: info.ip });
    await d.store.update(next);
    return "ok";
  }
  if (kind === "fail") {
    next = { ...next, failedAt: at, failMessage: info.message };
    await d.store.recordPing(m.id, { at, kind, durationMs: null, message: info.message, ip: info.ip });
  } else {
    const durationMs = m.lastStartAt && (!m.lastPingAt || Date.parse(m.lastStartAt) > Date.parse(m.lastPingAt)) ? now - Date.parse(m.lastStartAt) : null;
    next = { ...next, lastPingAt: at, failedAt: null, failMessage: null, lastDurationMs: durationMs ?? next.lastDurationMs };
    await d.store.recordPing(m.id, { at, kind, durationMs, message: null, ip: info.ip });
  }
  await d.store.update(next);
  if (!next.paused) await transition(next, evaluate(next, now), d);
  return "ok";
}
