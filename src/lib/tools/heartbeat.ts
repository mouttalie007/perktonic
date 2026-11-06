/**
 * The real storage, mail sender and scheduler of tool 4.10 (cron job heartbeat monitor).
 * The tool's own code (src/tools/cron-job-monitoring-heartbeat) only knows the HeartbeatStore and Notifier
 * interfaces; this file plugs Postgres, SMTP, Telegram and the 30-second sweep into them.
 * Started once per server process from src/instrumentation.ts.
 */
import nodemailer from "nodemailer";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { safeFetch } from "@/lib/tools/safe-fetch";
import { configureHeartbeat, getDeps } from "@/tools/cron-job-monitoring-heartbeat/src/logic/deps";
import type { HeartbeatStore, Notifier, SendResult } from "@/tools/cron-job-monitoring-heartbeat/src/logic/interfaces";
import { sweep } from "@/tools/cron-job-monitoring-heartbeat/src/logic/sweep";
import type { Monitor, MonitorEvent, Ping } from "@/tools/cron-job-monitoring-heartbeat/src/types";

const KEEP = 500; // pings and events kept per monitor
const IDLE_MS = 90 * 24 * 3600 * 1000;

const emailHashesOf = (m: Monitor) => m.emails.flatMap((e) => [e.confirmHash, ...e.stopHashes]).filter((h): h is string => !!h);
const activityOf = (m: Monitor) => new Date(m.lastPingAt ?? m.createdAt);
const asMonitor = (row: { data: Prisma.JsonValue } | null) => (row ? (row.data as unknown as Monitor) : null);

export class PrismaHeartbeatStore implements HeartbeatStore {
  async create(m: Monitor) {
    await prisma.heartbeatMonitor.create({
      data: {
        id: m.id,
        pingTokenHash: m.pingTokenHash,
        manageTokenHash: m.manageTokenHash,
        emailHashes: emailHashesOf(m),
        paused: m.paused,
        createdAt: new Date(m.createdAt),
        activityAt: activityOf(m),
        data: m as unknown as Prisma.InputJsonValue,
      },
    });
  }
  async findByPingHash(hash: string) {
    return asMonitor(await prisma.heartbeatMonitor.findUnique({ where: { pingTokenHash: hash } }));
  }
  async findByManageHash(hash: string) {
    return asMonitor(await prisma.heartbeatMonitor.findUnique({ where: { manageTokenHash: hash } }));
  }
  async findByEmailTokenHash(hash: string) {
    return asMonitor(await prisma.heartbeatMonitor.findFirst({ where: { emailHashes: { has: hash } } }));
  }
  /**
   * A ping and the sweep can update the same monitor within the same second. The row is locked, and when the stored
   * monitor holds a newer ping than the copy we were given, the ping fields of the stored one win (a ping is never lost).
   */
  async update(m: Monitor) {
    await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ data: Monitor }[]>`SELECT "data" FROM "heartbeat_monitors" WHERE "id" = ${m.id} FOR UPDATE`;
      const stored = rows[0]?.data;
      if (!stored) return;
      let next = m;
      if (stored.lastPingAt && (!m.lastPingAt || stored.lastPingAt > m.lastPingAt)) {
        next = { ...m, lastPingAt: stored.lastPingAt, lastStartAt: stored.lastStartAt, lastDurationMs: stored.lastDurationMs, failedAt: stored.failedAt, failMessage: stored.failMessage };
      }
      await tx.heartbeatMonitor.update({
        where: { id: m.id },
        data: { paused: next.paused, emailHashes: emailHashesOf(next), activityAt: activityOf(next), data: next as unknown as Prisma.InputJsonValue },
      });
    });
  }
  async recordPing(id: string, p: Ping) {
    const row = await prisma.heartbeatPing.create({ data: { monitorId: id, at: new Date(p.at), kind: p.kind, durationMs: p.durationMs, message: p.message, ip: p.ip } });
    const old = await prisma.heartbeatPing.findFirst({ where: { monitorId: id }, orderBy: { id: "desc" }, skip: KEEP, select: { id: true } });
    if (old && row.id > old.id) await prisma.heartbeatPing.deleteMany({ where: { monitorId: id, id: { lte: old.id } } });
  }
  async listPings(id: string, limit: number): Promise<Ping[]> {
    const rows = await prisma.heartbeatPing.findMany({ where: { monitorId: id }, orderBy: { id: "desc" }, take: limit });
    return rows.map((r) => ({ at: r.at.toISOString(), kind: r.kind as Ping["kind"], durationMs: r.durationMs, message: r.message, ip: r.ip }));
  }
  async recordEvent(id: string, e: MonitorEvent) {
    const row = await prisma.heartbeatEvent.create({ data: { monitorId: id, at: new Date(e.at), type: e.type, text: e.text, ok: e.ok } });
    const old = await prisma.heartbeatEvent.findFirst({ where: { monitorId: id }, orderBy: { id: "desc" }, skip: KEEP, select: { id: true } });
    if (old && row.id > old.id) await prisma.heartbeatEvent.deleteMany({ where: { monitorId: id, id: { lte: old.id } } });
  }
  async listEvents(id: string, limit: number): Promise<MonitorEvent[]> {
    const rows = await prisma.heartbeatEvent.findMany({ where: { monitorId: id }, orderBy: { id: "desc" }, take: limit });
    return rows.map((r) => ({ at: r.at.toISOString(), type: r.type as MonitorEvent["type"], text: r.text, ok: r.ok }));
  }
  /** Monitors the sweep looks at: every one that is not paused, plus paused ones idle long enough to be cleaned up. */
  async dueJobs(now: number) {
    const rows = await prisma.heartbeatMonitor.findMany({ where: { OR: [{ paused: false }, { activityAt: { lt: new Date(now - IDLE_MS) } }] }, select: { data: true } });
    return rows.map((r) => r.data as unknown as Monitor);
  }
  async delete(id: string) {
    await prisma.heartbeatMonitor.deleteMany({ where: { id } });
  }
  async count() {
    return prisma.heartbeatMonitor.count();
  }
}

/** Mail through SMTP (MAIL_FROM + SMTP_HOST/PORT/USER/PASS), webhooks and Telegram through safeFetch only. */
export class RealNotifier implements Notifier {
  private transport: nodemailer.Transporter | null = null;
  private mailer() {
    const host = process.env.SMTP_HOST;
    if (!host || !process.env.MAIL_FROM) return null;
    this.transport ??= nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT ?? 587) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" } : undefined,
      connectionTimeout: 10_000,
      socketTimeout: 15_000,
    });
    return this.transport;
  }
  async email(to: string, subject: string, text: string): Promise<SendResult> {
    const t = this.mailer();
    if (!t) return { ok: false, error: "Email is not set up on this site yet." };
    try {
      await t.sendMail({ from: process.env.MAIL_FROM, to, subject, text });
      return { ok: true };
    } catch (e) {
      console.error("[heartbeat] email failed:", e instanceof Error ? e.message : e);
      return { ok: false, error: "The email could not be sent." };
    }
  }
  private async postJson(url: string, payload: unknown) {
    try {
      const res = await safeFetch(url, { method: "POST", body: JSON.stringify(payload), headers: { "content-type": "application/json" }, timeoutMs: 10_000, maxBytes: 4096, userAgent: "PerkTonic-Heartbeat/1.0" });
      return res.status >= 200 && res.status < 300 ? ({ ok: true, status: res.status } as const) : ({ ok: false, error: `HTTP ${res.status}`, status: res.status } as const);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "request failed" } as const;
    }
  }
  webhook(url: string, payload: unknown) {
    return this.postJson(url, payload);
  }
  async telegram(chatId: string, text: string): Promise<SendResult> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return { ok: false, error: "Telegram is not set up on this site." };
    const r = await this.postJson(`https://api.telegram.org/bot${token}/sendMessage`, { chat_id: chatId, text });
    return r.ok ? { ok: true } : { ok: false, error: "Telegram refused the message." };
  }
  telegramConfigured() {
    return !!process.env.TELEGRAM_BOT_TOKEN;
  }
}

const G = globalThis as unknown as { __heartbeatTimer?: ReturnType<typeof setInterval> };

/** Plugs the real parts into the tool and starts the 30-second sweep (once per process). */
export function startHeartbeat() {
  configureHeartbeat({ store: new PrismaHeartbeatStore(), notifier: new RealNotifier() });
  if (G.__heartbeatTimer) return;
  let running = false;
  G.__heartbeatTimer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await sweep(getDeps(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"));
    } catch (e) {
      console.error("[heartbeat] sweep failed:", e instanceof Error ? e.message : e);
    } finally {
      running = false;
    }
  }, 30_000);
  G.__heartbeatTimer.unref?.();
}
