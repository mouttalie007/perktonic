import type { Monitor, State } from "../types";

/**
 * new: never pinged · up: the last ping is within the interval · late: the interval has passed but
 * the grace period has not · down: grace over, or a …/fail ping after the last success.
 */
export function evaluate(job: Pick<Monitor, "lastPingAt" | "failedAt" | "intervalSec" | "graceSec">, now: number): State {
  if (job.failedAt && (!job.lastPingAt || Date.parse(job.failedAt) >= Date.parse(job.lastPingAt))) return "down";
  if (!job.lastPingAt) return "new";
  const elapsed = now - Date.parse(job.lastPingAt);
  if (elapsed <= job.intervalSec * 1000) return "up";
  if (elapsed <= (job.intervalSec + job.graceSec) * 1000) return "late";
  return "down";
}

export function nextExpected(job: Pick<Monitor, "lastPingAt" | "intervalSec">): string | null {
  return job.lastPingAt ? new Date(Date.parse(job.lastPingAt) + job.intervalSec * 1000).toISOString() : null;
}

/** "15 minutes", "2 hours", "1 day 6 hours". */
export function describeSeconds(sec: number): string {
  const parts: string[] = [];
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d) parts.push(`${d} day${d === 1 ? "" : "s"}`);
  if (h) parts.push(`${h} hour${h === 1 ? "" : "s"}`);
  if (m) parts.push(`${m} minute${m === 1 ? "" : "s"}`);
  return parts.join(" ") || `${sec} seconds`;
}
