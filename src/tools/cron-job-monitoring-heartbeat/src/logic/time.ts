/** A UTC ISO time shown in the visitor's time zone (the store keeps UTC). */
export function inZone(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "short" }).format(new Date(iso));
}

/** "3 min ago", "in 12 min" relative to now. */
export function relative(iso: string, now: number): string {
  const ms = Date.parse(iso) - now;
  const abs = Math.abs(Math.round(ms / 60000));
  const words = abs < 1 ? "less than a minute" : abs < 120 ? `${abs} min` : abs < 48 * 60 ? `${Math.round(abs / 60)} h` : `${Math.round(abs / 1440)} days`;
  return ms <= 0 ? `${words} ago` : `in ${words}`;
}
