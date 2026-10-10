/**
 * Random backdated publish date (perktonic workflow, 2026-10-09) — the
 * site was originally planned to launch ~2 months ago; production ran
 * late, so freshly published articles default to a random date in that
 * window instead of "today", so the site doesn't look like everything
 * went up on the same day. Pre-fills the editable "Publish date" field —
 * the admin can always override it.
 */
const BACKDATE_WINDOW_DAYS = 60;

/** Returns a `datetime-local`-input-ready string, randomly within the last `days`. */
export function randomBackdatedPublishedAt(days = BACKDATE_WINDOW_DAYS): string {
  const now = Date.now();
  const past = now - days * 86_400_000;
  const t = past + Math.random() * (now - past);
  return new Date(t).toISOString().slice(0, 16);
}
