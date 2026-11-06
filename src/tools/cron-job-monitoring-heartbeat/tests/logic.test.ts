import { describe, expect, test, vi } from "vitest";
import { fakeDeps, MIN } from "../fixtures/fakes";
import { describeSeconds, evaluate, nextExpected } from "../src/logic/evaluate";
import { recordPing } from "../src/logic/pings";
import { confirmEmail, createMonitor, setPaused, stopEmail, testAlert } from "../src/logic/service";
import { sweep } from "../src/logic/sweep";
import { isToken, sha256 } from "../src/logic/tokens";

const base = { name: "Nightly backup", intervalSec: 15 * 60, graceSec: 5 * 60, emails: [] as string[], webhookUrl: null as string | null, telegramChatId: null as string | null };

async function setup(extra: Partial<typeof base> = {}, opts: Parameters<typeof fakeDeps>[0] = {}) {
  const f = fakeDeps(opts);
  const r = await createMonitor({ ...base, ...extra }, f.deps);
  if (!r.ok) throw new Error(r.message);
  return { ...f, ...r, ping: (kind: "success" | "fail" | "start" = "success", message: string | null = null) => recordPing(r.pingToken, kind, { message, ip: "198.51.100.4" }, f.deps) };
}

describe("evaluate(job, now)", () => {
  const t0 = Date.UTC(2026, 10, 3, 9, 0, 0);
  const job = (lastPingAt: string | null, failedAt: string | null = null) => ({ lastPingAt, failedAt, intervalSec: 900, graceSec: 300 });
  const at = (min: number) => new Date(t0 + min * MIN).toISOString();
  test("new, up, late (inside the grace period) and down (grace over)", () => {
    expect(evaluate(job(null), t0)).toBe("new");
    expect(evaluate(job(at(0)), t0 + 15 * MIN)).toBe("up");
    expect(evaluate(job(at(0)), t0 + 15 * MIN + 1)).toBe("late");
    expect(evaluate(job(at(0)), t0 + 20 * MIN)).toBe("late");
    expect(evaluate(job(at(0)), t0 + 20 * MIN + 1)).toBe("down");
  });
  test("a fail ping is down until the next success; next expected ping and durations in words", () => {
    expect(evaluate(job(at(0), at(1)), t0 + 2 * MIN)).toBe("down");
    expect(evaluate(job(at(3), at(1)), t0 + 4 * MIN)).toBe("up");
    expect(nextExpected(job(at(0)))).toBe(at(15));
    expect(describeSeconds(90000)).toBe("1 day 1 hour");
    expect(describeSeconds(900)).toBe("15 minutes");
  });
});

describe("tokens", () => {
  test("128-bit random, URL-safe, shown once; the store keeps only their SHA-256", async () => {
    const { pingToken, manageToken, store } = await setup();
    expect(isToken(pingToken) && isToken(manageToken)).toBe(true);
    const raw = JSON.stringify(store.raw());
    expect(raw).not.toContain(pingToken);
    expect(raw).not.toContain(manageToken);
    expect(raw).toContain(await sha256(pingToken));
  });
});

describe("sweep(): one alert per outage, one recovery notice", () => {
  test("up → late → down alerts once; staying down does not repeat; the next ping sends 'recovered' once", async () => {
    const s = await setup({ webhookUrl: "https://hooks.example.com/cron" });
    await s.ping();
    s.advance(16 * MIN);
    await sweep(s.deps);
    expect(s.store.raw()[0].state).toBe("late");
    expect(s.notifier.sent).toHaveLength(0);
    s.advance(5 * MIN);
    await sweep(s.deps);
    expect(s.store.raw()[0].state).toBe("down");
    for (let i = 0; i < 10; i++) {
      s.advance(30_000);
      await sweep(s.deps);
    }
    expect(s.notifier.sent.map((x) => (x.payload as { event: string }).event)).toEqual(["down"]);
    await s.ping();
    s.advance(MIN);
    await sweep(s.deps);
    expect(s.notifier.sent.map((x) => (x.payload as { event: string }).event)).toEqual(["down", "recovered"]);
    const events = await s.store.listEvents(s.store.raw()[0].id, 50);
    expect(events.filter((e) => e.type === "state").map((e) => e.text).reverse()).toEqual(["new → up", "up → late", "late → down", "down → up"]);
  });

  test("a …/fail ping marks the job down at once with its message; /start measures the run", async () => {
    const s = await setup({ webhookUrl: "https://hooks.example.com/cron" });
    await s.ping("start");
    s.advance(42_000);
    await s.ping();
    expect(s.store.raw()[0].lastDurationMs).toBe(42_000);
    s.advance(MIN);
    await s.ping("fail", "pg_dump: connection refused");
    expect(s.store.raw()[0]).toMatchObject({ state: "down", failMessage: "pg_dump: connection refused" });
    expect((s.notifier.sent[0].payload as { failMessage: string }).failMessage).toBe("pg_dump: connection refused");
  });

  test("pings faster than one per 10 seconds are accepted but not recorded", async () => {
    const s = await setup();
    expect(await s.ping()).toBe("ok");
    s.advance(5000);
    expect(await s.ping()).toBe("ignored");
    s.advance(6000);
    expect(await s.ping()).toBe("ok");
    expect(await s.store.listPings(s.store.raw()[0].id, 50)).toHaveLength(2);
    expect(await recordPing("A".repeat(22), "success", { message: null, ip: null }, s.deps)).toBe("unknown");
  });

  test("paused monitors do not alert; unused monitors are removed after 7 days (never pinged) or 90 days", async () => {
    const s = await setup({ webhookUrl: "https://hooks.example.com/cron" });
    await s.ping();
    await setPaused(s.manageToken, true, s.deps);
    s.advance(60 * MIN);
    await sweep(s.deps);
    expect(s.notifier.sent).toHaveLength(0);
    s.advance(91 * 24 * 60 * MIN);
    expect((await sweep(s.deps)).deleted).toBe(1);
    const n = await setup();
    n.advance(8 * 24 * 60 * MIN);
    expect((await sweep(n.deps)).deleted).toBe(1);
    expect(await n.store.count()).toBe(0);
  });
});

describe("alert channels", () => {
  test("email: confirmation first (no alert before), a one-click stop link in every alert", async () => {
    const s = await setup({ emails: ["Ops@Example.com"] });
    const confirmMail = s.notifier.sent[0];
    expect(confirmMail).toMatchObject({ channel: "email", to: "ops@example.com", subject: 'Confirm alerts for "Nightly backup"' });
    await s.ping();
    s.advance(30 * MIN);
    await sweep(s.deps);
    expect(s.notifier.sent.filter((x) => x.subject?.startsWith("[DOWN]"))).toHaveLength(0);
    const confirmToken = /confirm=([A-Za-z0-9_-]{22})/.exec(confirmMail.text!)![1];
    expect((await confirmEmail(confirmToken, s.deps)).ok).toBe(true);
    await s.ping();
    s.advance(30 * MIN);
    await sweep(s.deps);
    const alert = s.notifier.sent.find((x) => x.subject?.startsWith("[DOWN]"))!;
    expect(alert.text).toMatch(/Stop these alerts \(one click\): https:\/\/perktonic\.com\/tools\/cron-job-monitoring-heartbeat\?stop=/);
    const stop = /stop=([A-Za-z0-9_-]{22})/.exec(alert.text!)![1];
    expect((await stopEmail(stop, s.deps)).ok).toBe(true);
    expect(s.store.raw()[0].emails).toEqual([]);
    expect(JSON.stringify(s.store.raw())).not.toContain(stop);
  });

  test("webhook: 3 attempts with back-off; the visitor sees the last result", async () => {
    const s = await setup({ webhookUrl: "https://hooks.example.com/cron" }, { webhookFails: 2 });
    const r = await testAlert(s.manageToken, s.deps);
    expect(r.ok && r.data.lastWebhook).toMatchObject({ ok: true, attempts: 3, detail: "HTTP 200" });
    expect(s.sleeps).toEqual([5000, 10000]);
    const f = await setup({ webhookUrl: "https://down.example.com" }, { webhookFails: 9 });
    const r2 = await testAlert(f.manageToken, f.deps);
    expect(r2.ok && r2.data.lastWebhook).toMatchObject({ ok: false, attempts: 3, detail: "HTTP 503" });
  });

  test("Telegram only when the notifier is configured; a test needs a channel", async () => {
    const off = fakeDeps();
    expect(await createMonitor({ ...base, telegramChatId: "123456789" }, off.deps)).toMatchObject({ ok: false, code: "telegram_unavailable" });
    const on = await setup({ telegramChatId: "123456789" }, { telegram: true });
    expect(on.monitor.telegramAvailable).toBe(true);
    await testAlert(on.manageToken, on.deps);
    expect(on.notifier.sent[0]).toMatchObject({ channel: "telegram", to: "123456789" });
    const none = await setup();
    expect(await testAlert(none.manageToken, none.deps)).toMatchObject({ ok: false, code: "no_channel" });
  });
});

describe("time zones and limits", () => {
  test("times are stored in UTC and shown in the visitor's zone", async () => {
    const { inZone, relative } = await import("../src/logic/time");
    expect(inZone("2026-11-03T09:00:00.000Z", "Europe/Paris")).toBe("3 Nov 2026, 10:00:00 CET");
    expect(inZone("2026-07-03T09:00:00.000Z", "America/New_York")).toMatch(/^3 Jul 2026, 05:00:00 (EDT|GMT-4)$/);
    expect(relative("2026-11-03T08:57:00.000Z", Date.UTC(2026, 10, 3, 9, 0, 0))).toBe("3 min ago");
    const s = await setup();
    expect(s.store.raw()[0].createdAt).toBe("2026-11-03T09:00:00.000Z");
  });
  test("at most 5,000 monitors in total", async () => {
    const f = fakeDeps();
    vi.spyOn(f.store, "count").mockResolvedValue(5000);
    expect(await createMonitor(base, f.deps)).toMatchObject({ ok: false, code: "full" });
  });
});
