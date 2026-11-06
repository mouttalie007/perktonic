import type { Clock } from "../src/logic/store";

/** A clock the tests move by hand. */
export function fakeClock(start = Date.UTC(2026, 10, 2, 9, 0, 0)): Clock & { advance(ms: number): void; set(t: number): void } {
  let t = start;
  return { now: () => t, advance: (ms) => (t += ms), set: (v) => (t = v) };
}

/** Deterministic ids: A000…, A001… (22 URL-safe characters). */
export function seqIds(prefix = "A") {
  let n = 0;
  return () => `${prefix}${String(n++).padStart(21, "0")}`;
}
