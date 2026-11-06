// The read-only demo the page opens with: a monitor that pings every 15 minutes, with one outage
// and its recovery. Nothing is created until the visitor presses "Create monitor".
import type { MonitorEvent, MonitorView, Ping } from "../src/types";

const t = (min: number) => new Date(Date.UTC(2026, 10, 3, 9, 0, 0) - min * 60_000).toISOString();

const pings: Ping[] = [0, 15, 30, 45, 60, 75, 140, 155, 170, 185].map((m, i) => ({ at: t(m), kind: "success", durationMs: 38_000 + ((i * 7919) % 9000), message: null, ip: "198.51.100.23" }));
pings.splice(6, 0, { at: t(118), kind: "fail", durationMs: null, message: "pg_dump: error: connection to server failed: timeout", ip: "198.51.100.23" });

const events: MonitorEvent[] = [
  { at: t(75), type: "alert", text: "Email to ops@example.com: sent", ok: true },
  { at: t(75), type: "state", text: "down → up", ok: true },
  { at: t(118), type: "alert", text: "Webhook: delivered after 1 attempt (HTTP 200)", ok: true },
  { at: t(118), type: "alert", text: "Email to ops@example.com: sent", ok: true },
  { at: t(118), type: "state", text: "up → down", ok: false },
  { at: t(186), type: "state", text: "new → up", ok: true },
  { at: t(190), type: "email", text: "ops@example.com confirmed.", ok: true },
];

export const SAMPLE_MONITOR: MonitorView = {
  id: "demo",
  name: "Nightly database backup",
  intervalSec: 15 * 60,
  graceSec: 5 * 60,
  createdAt: t(200),
  state: "up",
  paused: false,
  lastPingAt: t(0),
  nextExpectedAt: t(-15),
  lastDurationMs: 41_200,
  failMessage: null,
  emails: [{ address: "ops@example.com", confirmed: true }],
  webhookUrl: "https://hooks.example.com/cron-alerts",
  lastWebhook: { at: t(118), ok: true, attempts: 1, detail: "HTTP 200" },
  telegram: false,
  telegramAvailable: false,
  pings,
  events,
};

export const SAMPLE_PING_URL = "https://perktonic.com/api/tools/cron-job-monitoring-heartbeat/ping/DEMO-ping-token-xxxxx";
