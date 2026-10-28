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
export function randomBackdatedPublishedAt(
  days = BACKDATE_WINDOW_DAYS,
): string {
  // 2026-10-28: back-dating is switched OFF while the date policy is reviewed (AdSense
  // flagged the site; dates before the real launch can read as misrepresentation).
  // New articles pre-fill with the real current time. To re-enable the random
  // window, replace `now` below with `past + Math.random() * (now - past)`.
  const now = Date.now();
  void days;
  return new Date(now).toISOString().slice(0, 16);
}
