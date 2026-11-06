// Called by the scheduler every 30 seconds.
import { IDLE_DAYS, NEVER_PINGED_DAYS } from "../limits";
import { transition, type Deps } from "./alerts";
import { evaluate } from "./evaluate";

const DAY = 86_400_000;

export async function sweep(d: Deps): Promise<{ checked: number; changed: number; deleted: number }> {
  const now = d.clock.now();
  let changed = 0;
  let deleted = 0;
  const jobs = await d.store.dueJobs(now);
  for (const m of jobs) {
    // Free, no account: unused monitors are removed.
    if (!m.lastPingAt && now - Date.parse(m.createdAt) > NEVER_PINGED_DAYS * DAY) {
      await d.store.delete(m.id);
      deleted++;
      continue;
    }
    if (m.lastPingAt && now - Date.parse(m.lastPingAt) > IDLE_DAYS * DAY) {
      await d.store.delete(m.id);
      deleted++;
      continue;
    }
    if (m.paused) continue;
    const s = evaluate(m, now);
    if (s !== m.state) {
      await transition(m, s, d);
      changed++;
    }
  }
  return { checked: jobs.length, changed, deleted };
}
