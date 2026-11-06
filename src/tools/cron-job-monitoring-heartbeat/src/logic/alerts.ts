// One alert per state change: up → down sends "DOWN" once; the next ping sends "recovered" once.
import { TOOL_PATH, WEBHOOK_ATTEMPTS } from "../limits";
import type { Monitor, State } from "../types";
import { describeSeconds } from "./evaluate";
import type { Clock, HeartbeatStore, Notifier } from "./interfaces";
import { newToken, sha256 } from "./tokens";

export interface Deps {
  store: HeartbeatStore;
  notifier: Notifier;
  clock: Clock;
  /** Waits between webhook attempts (back-off); tests pass a fake. */
  sleep: (ms: number) => Promise<void>;
  /** https://perktonic.com, used in email links. */
  origin: string;
}

const iso = (d: Deps) => new Date(d.clock.now()).toISOString();

export function alertText(m: Monitor, kind: "down" | "recovered" | "test", origin: string): { subject: string; text: string; payload: unknown } {
  const dash = `${origin}${TOOL_PATH}`;
  const subject = kind === "down" ? `[DOWN] ${m.name} has not checked in` : kind === "recovered" ? `[UP] ${m.name} is back` : `[TEST] Alert test for ${m.name}`;
  const why = kind === "down" ? (m.failMessage !== null && m.failedAt ? `The job reported a failure: ${m.failMessage || "(no message)"}` : `No ping arrived within ${describeSeconds(m.intervalSec)} plus a grace period of ${describeSeconds(m.graceSec)}.`) : kind === "recovered" ? "A successful ping arrived again." : "This is a test sent from the dashboard.";
  const last = m.lastPingAt ? `Last ping: ${m.lastPingAt} (UTC).` : "No ping has arrived yet.";
  return { subject, text: `${subject}\n\n${why}\n${last}\n\nOpen your private dashboard link to see the history (${dash}).`, payload: { monitor: m.name, event: kind, state: kind === "recovered" ? "up" : kind === "down" ? "down" : m.state, lastPingAt: m.lastPingAt, failMessage: m.failMessage, at: null as string | null } };
}

/** Sends to every channel; never throws. Records one event per channel and the webhook's last result on the monitor. */
export async function sendAlert(m: Monitor, kind: "down" | "recovered" | "test", d: Deps): Promise<Monitor> {
  const { subject, text, payload } = alertText(m, kind, d.origin);
  const emails = [];
  for (const e of m.emails) {
    if (!e.confirmed) {
      emails.push(e);
      continue;
    }
    // Every email carries a one-click stop link with its own token; only the hash is kept.
    const stop = newToken();
    const footer = `\n\nStop these alerts (one click): ${d.origin}${TOOL_PATH}?stop=${stop}\nYou get this because the address was confirmed for this monitor.`;
    const r = await d.notifier.email(e.address, subject, text + footer);
    emails.push({ ...e, stopHashes: [await sha256(stop), ...e.stopHashes].slice(0, 10) });
    await d.store.recordEvent(m.id, { at: iso(d), type: "alert", text: `Email to ${e.address}: ${r.ok ? "sent" : r.error}`, ok: r.ok });
  }
  let next: Monitor = { ...m, emails };
  if (m.webhookUrl) {
    let last: { ok: boolean; detail: string } = { ok: false, detail: "not sent" };
    let attempts = 0;
    for (let i = 0; i < WEBHOOK_ATTEMPTS; i++) {
      attempts++;
      const r = await d.notifier.webhook(m.webhookUrl, { ...(payload as object), at: iso(d) });
      last = r.ok ? { ok: true, detail: `HTTP ${r.status ?? 200}` } : { ok: false, detail: r.error };
      if (r.ok) break;
      if (i < WEBHOOK_ATTEMPTS - 1) await d.sleep(1000 * 2 ** i * 5);
    }
    next = { ...next, lastWebhook: { at: iso(d), ok: last.ok, attempts, detail: last.detail } };
    await d.store.recordEvent(m.id, { at: iso(d), type: "alert", text: `Webhook: ${last.ok ? "delivered" : "failed"} after ${attempts} attempt${attempts === 1 ? "" : "s"} (${last.detail})`, ok: last.ok });
  }
  if (m.telegramChatId && d.notifier.telegram && d.notifier.telegramConfigured()) {
    const r = await d.notifier.telegram(m.telegramChatId, text);
    await d.store.recordEvent(m.id, { at: iso(d), type: "alert", text: `Telegram: ${r.ok ? "sent" : r.error}`, ok: r.ok });
  }
  return next;
}

/** Records a state change and alerts when it is a change to or from "down". */
export async function transition(m: Monitor, to: State, d: Deps): Promise<Monitor> {
  if (m.state === to) return m;
  const from = m.state;
  let next: Monitor = { ...m, state: to };
  await d.store.recordEvent(m.id, { at: iso(d), type: "state", text: `${from} → ${to}`, ok: to !== "down" });
  if (to === "down") next = await sendAlert(next, "down", d);
  else if (from === "down" && to === "up") next = await sendAlert(next, "recovered", d);
  await d.store.update(next);
  return next;
}
