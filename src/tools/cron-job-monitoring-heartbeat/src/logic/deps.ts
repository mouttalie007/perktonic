// INTEGRATOR: call configureHeartbeat({ store, notifier, clock }) once at start-up with the real
// Postgres store, mailer and clock. Until then the sandbox uses the in-memory versions.
import type { Deps } from "./alerts";
import type { Clock, HeartbeatStore, Notifier } from "./interfaces";
import { MemoryHeartbeatStore, RecordingNotifier } from "./memory";

const G = globalThis as unknown as { __heartbeat?: { store: HeartbeatStore; notifier: Notifier; clock: Clock } };

export function configureHeartbeat(parts: { store: HeartbeatStore; notifier: Notifier; clock?: Clock }) {
  G.__heartbeat = { clock: { now: () => Date.now() }, ...parts };
}

export function getDeps(origin: string): Deps {
  G.__heartbeat ??= { store: new MemoryHeartbeatStore(), notifier: new RecordingNotifier(), clock: { now: () => Date.now() } };
  return { ...G.__heartbeat, origin, sleep: (ms) => new Promise((r) => setTimeout(r, ms)) };
}
