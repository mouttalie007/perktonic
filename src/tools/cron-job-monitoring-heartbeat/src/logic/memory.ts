// In-memory HeartbeatStore and a recording Notifier: used by the tests and the sandbox playground.
// INTEGRATOR: the real Postgres store, mail sender and scheduler replace these (see README).
import type { Monitor, MonitorEvent, Ping } from "../types";
import type { HeartbeatStore, Notifier, SendResult } from "./interfaces";

export class MemoryHeartbeatStore implements HeartbeatStore {
  private monitors = new Map<string, Monitor>();
  private pings = new Map<string, Ping[]>();
  private events = new Map<string, MonitorEvent[]>();

  async create(m: Monitor) {
    this.monitors.set(m.id, structuredClone(m));
  }
  private find(pred: (m: Monitor) => boolean) {
    for (const m of this.monitors.values()) if (pred(m)) return structuredClone(m);
    return null;
  }
  async findByPingHash(h: string) {
    return this.find((m) => m.pingTokenHash === h);
  }
  async findByManageHash(h: string) {
    return this.find((m) => m.manageTokenHash === h);
  }
  async findByEmailTokenHash(h: string) {
    return this.find((m) => m.emails.some((e) => e.confirmHash === h || e.stopHashes.includes(h)));
  }
  async update(m: Monitor) {
    if (this.monitors.has(m.id)) this.monitors.set(m.id, structuredClone(m));
  }
  async recordPing(id: string, p: Ping) {
    this.pings.set(id, [p, ...(this.pings.get(id) ?? [])].slice(0, 500));
  }
  async listPings(id: string, limit: number) {
    return (this.pings.get(id) ?? []).slice(0, limit);
  }
  async recordEvent(id: string, e: MonitorEvent) {
    this.events.set(id, [e, ...(this.events.get(id) ?? [])].slice(0, 500));
  }
  async listEvents(id: string, limit: number) {
    return (this.events.get(id) ?? []).slice(0, limit);
  }
  async dueJobs() {
    return [...this.monitors.values()].map((m) => structuredClone(m));
  }
  async delete(id: string) {
    this.monitors.delete(id);
    this.pings.delete(id);
    this.events.delete(id);
  }
  async count() {
    return this.monitors.size;
  }
  /** For tests: what the store really holds. */
  raw() {
    return [...this.monitors.values()];
  }
}

export class RecordingNotifier implements Notifier {
  sent: { channel: "email" | "webhook" | "telegram"; to: string; subject?: string; text?: string; payload?: unknown }[] = [];
  constructor(private opts: { telegram?: boolean; webhookFails?: number } = {}) {}
  private webhookCalls = 0;
  async email(to: string, subject: string, text: string): Promise<SendResult> {
    this.sent.push({ channel: "email", to, subject, text });
    return { ok: true };
  }
  async webhook(url: string, payload: unknown): Promise<SendResult & { status?: number }> {
    this.webhookCalls++;
    this.sent.push({ channel: "webhook", to: url, payload });
    if (this.webhookCalls <= (this.opts.webhookFails ?? 0)) return { ok: false, error: "HTTP 503" };
    return { ok: true, status: 200 };
  }
  async telegram(chatId: string, text: string): Promise<SendResult> {
    this.sent.push({ channel: "telegram", to: chatId, text });
    return { ok: true };
  }
  telegramConfigured() {
    return !!this.opts.telegram;
  }
}
