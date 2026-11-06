// The dashboard actions. Tokens are shown once (at creation); only their SHA-256 is stored.
import { HISTORY, MAX_MONITORS } from "../limits";
import type { Monitor, MonitorView } from "../types";
import { sendAlert, transition, type Deps } from "./alerts";
import { evaluate, nextExpected } from "./evaluate";
import { newToken, sha256 } from "./tokens";

export interface CreateInput {
  name: string;
  intervalSec: number;
  graceSec: number;
  emails: string[];
  webhookUrl: string | null;
  telegramChatId: string | null;
}

export type Fail = { ok: false; code: string; message: string; status: number };

export async function view(m: Monitor, d: Deps): Promise<MonitorView> {
  const now = d.clock.now();
  return {
    id: m.id,
    name: m.name,
    intervalSec: m.intervalSec,
    graceSec: m.graceSec,
    createdAt: m.createdAt,
    state: m.paused ? m.state : evaluate(m, now),
    paused: m.paused,
    lastPingAt: m.lastPingAt,
    nextExpectedAt: nextExpected(m),
    lastDurationMs: m.lastDurationMs,
    failMessage: m.failedAt ? m.failMessage : null,
    emails: m.emails.map((e) => ({ address: e.address, confirmed: e.confirmed })),
    webhookUrl: m.webhookUrl,
    lastWebhook: m.lastWebhook,
    telegram: !!m.telegramChatId,
    telegramAvailable: d.notifier.telegramConfigured(),
    pings: await d.store.listPings(m.id, HISTORY),
    events: await d.store.listEvents(m.id, HISTORY),
  };
}

async function sendConfirmation(m: Monitor, address: string, token: string, d: Deps) {
  const link = `${d.origin}/tools/cron-job-monitoring-heartbeat?confirm=${token}`;
  const r = await d.notifier.email(address, `Confirm alerts for "${m.name}"`, `Someone asked to send alerts for the cron monitor "${m.name}" to this address.\n\nConfirm (no alert is sent before you do): ${link}\n\nIf this was not you, ignore this email: nothing will be sent.`);
  await d.store.recordEvent(m.id, { at: new Date(d.clock.now()).toISOString(), type: "email", text: `Confirmation email to ${address}: ${r.ok ? "sent" : r.error}`, ok: r.ok });
}

export async function createMonitor(input: CreateInput, d: Deps): Promise<{ ok: true; pingToken: string; manageToken: string; monitor: MonitorView } | Fail> {
  if ((await d.store.count()) >= MAX_MONITORS) return { ok: false, code: "full", status: 503, message: "The monitor service is full right now. Please try again later." };
  if (input.telegramChatId && !d.notifier.telegramConfigured()) return { ok: false, code: "telegram_unavailable", status: 400, message: "Telegram alerts are not available on this site." };
  const pingToken = newToken();
  const manageToken = newToken();
  const confirmTokens = input.emails.map(() => newToken());
  const m: Monitor = {
    id: newToken(),
    name: input.name.trim(),
    intervalSec: input.intervalSec,
    graceSec: input.graceSec,
    createdAt: new Date(d.clock.now()).toISOString(),
    lastPingAt: null,
    lastStartAt: null,
    lastDurationMs: null,
    failedAt: null,
    failMessage: null,
    paused: false,
    state: "new",
    pingTokenHash: await sha256(pingToken),
    manageTokenHash: await sha256(manageToken),
    emails: await Promise.all(input.emails.map(async (address, i) => ({ address: address.trim().toLowerCase(), confirmed: false, confirmHash: await sha256(confirmTokens[i]), stopHashes: [] }))),
    webhookUrl: input.webhookUrl,
    lastWebhook: null,
    telegramChatId: input.telegramChatId,
  };
  await d.store.create(m);
  for (const [i, e] of m.emails.entries()) await sendConfirmation(m, e.address, confirmTokens[i], d);
  return { ok: true, pingToken, manageToken, monitor: await view(m, d) };
}

const notFound: Fail = { ok: false, code: "not_found", status: 404, message: "This dashboard link is not valid, or the monitor was deleted." };

export async function byManage(token: string, d: Deps): Promise<Monitor | null> {
  return d.store.findByManageHash(await sha256(token));
}

export async function setPaused(token: string, paused: boolean, d: Deps) {
  const m = await byManage(token, d);
  if (!m) return notFound;
  let next: Monitor = { ...m, paused };
  await d.store.update(next);
  await d.store.recordEvent(m.id, { at: new Date(d.clock.now()).toISOString(), type: "settings", text: paused ? "Paused: no alerts until resumed." : "Resumed.", ok: true });
  if (!paused) next = await transition(next, evaluate(next, d.clock.now()), d);
  return { ok: true as const, data: await view(next, d) };
}

export async function testAlert(token: string, d: Deps) {
  const m = await byManage(token, d);
  if (!m) return notFound;
  if (!m.emails.some((e) => e.confirmed) && !m.webhookUrl && !m.telegramChatId) return { ok: false as const, code: "no_channel", status: 400, message: "There is no alert channel yet: add a webhook, or confirm an email address first." };
  const next = await sendAlert(m, "test", d);
  await d.store.update(next);
  return { ok: true as const, data: await view(next, d) };
}

export async function deleteMonitor(token: string, d: Deps) {
  const m = await byManage(token, d);
  if (!m) return notFound;
  await d.store.delete(m.id);
  return { ok: true as const, data: { deleted: true } };
}

/** Confirmation link from the email: the address starts receiving alerts. */
export async function confirmEmail(token: string, d: Deps) {
  const hash = await sha256(token);
  const m = await d.store.findByEmailTokenHash(hash);
  const e = m?.emails.find((x) => x.confirmHash === hash);
  if (!m || !e) return { ok: false as const, code: "not_found", status: 404, message: "This confirmation link is not valid any more." };
  await d.store.update({ ...m, emails: m.emails.map((x) => (x === e ? { ...x, confirmed: true, confirmHash: null } : x)) });
  await d.store.recordEvent(m.id, { at: new Date(d.clock.now()).toISOString(), type: "email", text: `${e.address} confirmed.`, ok: true });
  return { ok: true as const, data: { address: e.address, monitor: m.name } };
}

/** One-click stop link from an alert email: the address is removed from the monitor. */
export async function stopEmail(token: string, d: Deps) {
  const hash = await sha256(token);
  const m = await d.store.findByEmailTokenHash(hash);
  const e = m?.emails.find((x) => x.stopHashes.includes(hash) || x.confirmHash === hash);
  if (!m || !e) return { ok: false as const, code: "not_found", status: 404, message: "This link is not valid any more (the address may already be removed)." };
  await d.store.update({ ...m, emails: m.emails.filter((x) => x !== e) });
  await d.store.recordEvent(m.id, { at: new Date(d.clock.now()).toISOString(), type: "email", text: `${e.address} stopped receiving alerts.`, ok: true });
  return { ok: true as const, data: { address: e.address, monitor: m.name } };
}
