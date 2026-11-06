// Types shared by the server and the browser component (type-only imports).

export type State = "new" | "up" | "late" | "down";

export interface EmailChannel {
  address: string;
  confirmed: boolean;
  /** SHA-256 of the confirmation token (tokens themselves are never stored); null once confirmed. */
  confirmHash: string | null;
  /** SHA-256 of the stop tokens of the last alert emails (each email carries its own one-click stop link). */
  stopHashes: string[];
}

export interface WebhookResult {
  at: string;
  ok: boolean;
  attempts: number;
  detail: string;
}

export interface Monitor {
  id: string;
  name: string;
  intervalSec: number;
  graceSec: number;
  createdAt: string;
  /** UTC ISO times. */
  lastPingAt: string | null;
  lastStartAt: string | null;
  lastDurationMs: number | null;
  /** A …/fail ping marks the job down until the next successful ping. */
  failedAt: string | null;
  failMessage: string | null;
  paused: boolean;
  /** The state we last recorded (and alerted on). */
  state: State;
  pingTokenHash: string;
  manageTokenHash: string;
  emails: EmailChannel[];
  webhookUrl: string | null;
  lastWebhook: WebhookResult | null;
  telegramChatId: string | null;
}

export interface Ping {
  at: string;
  kind: "success" | "fail" | "start";
  durationMs: number | null;
  message: string | null;
  ip: string | null;
}

export interface MonitorEvent {
  at: string;
  type: "state" | "alert" | "email" | "settings";
  text: string;
  ok: boolean;
}

/** What the dashboard shows (no token hashes). */
export interface MonitorView {
  id: string;
  name: string;
  intervalSec: number;
  graceSec: number;
  createdAt: string;
  state: State;
  paused: boolean;
  lastPingAt: string | null;
  nextExpectedAt: string | null;
  lastDurationMs: number | null;
  failMessage: string | null;
  emails: { address: string; confirmed: boolean }[];
  webhookUrl: string | null;
  lastWebhook: WebhookResult | null;
  telegram: boolean;
  telegramAvailable: boolean;
  pings: Ping[];
  events: MonitorEvent[];
}

export type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };
