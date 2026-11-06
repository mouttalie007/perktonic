import type { Deps } from "../src/logic/alerts";
import { MemoryHeartbeatStore, RecordingNotifier } from "../src/logic/memory";

/** A fake clock, the in-memory store and a recording notifier, wired as the services expect. */
export function fakeDeps(opts: { telegram?: boolean; webhookFails?: number; start?: number } = {}) {
  let t = opts.start ?? Date.UTC(2026, 10, 3, 9, 0, 0);
  const clock = { now: () => t };
  const store = new MemoryHeartbeatStore();
  const notifier = new RecordingNotifier(opts);
  const sleeps: number[] = [];
  const deps: Deps = { store, notifier, clock, origin: "https://perktonic.com", sleep: async (ms) => void sleeps.push(ms) };
  return { deps, store, notifier, sleeps, advance: (ms: number) => (t += ms), now: () => t };
}

export const MIN = 60_000;
