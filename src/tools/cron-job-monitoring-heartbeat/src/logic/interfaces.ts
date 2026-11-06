// Everything that touches storage, mail or time goes through these interfaces. The Integrator
// provides the real Postgres store, mail sender and scheduler; tests use in-memory fakes.
import type { Monitor, MonitorEvent, Ping } from "../types";

export interface Clock {
  now(): number;
}

export interface HeartbeatStore {
  create(m: Monitor): Promise<void>;
  findByPingHash(hash: string): Promise<Monitor | null>;
  findByManageHash(hash: string): Promise<Monitor | null>;
  findByEmailTokenHash(hash: string): Promise<Monitor | null>;
  update(m: Monitor): Promise<void>;
  recordPing(id: string, p: Ping): Promise<void>;
  /** Newest first. */
  listPings(id: string, limit: number): Promise<Ping[]>;
  recordEvent(id: string, e: MonitorEvent): Promise<void>;
  listEvents(id: string, limit: number): Promise<MonitorEvent[]>;
  /** Monitors the sweep must look at: not paused (and old ones, for clean-up). */
  dueJobs(now: number): Promise<Monitor[]>;
  delete(id: string): Promise<void>;
  count(): Promise<number>;
}

export type SendResult = { ok: true } | { ok: false; error: string };

/** Each method returns ok or an error and never throws. */
export interface Notifier {
  email(to: string, subject: string, text: string): Promise<SendResult>;
  /** POST JSON (the real one goes through safeFetch). */
  webhook(url: string, payload: unknown): Promise<SendResult & { status?: number }>;
  telegram?(chatId: string, text: string): Promise<SendResult>;
  telegramConfigured(): boolean;
}
