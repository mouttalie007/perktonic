export interface WallTime {
  y: number;
  m: number;
  d: number;
  h: number;
  mi: number;
  s: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    formatters.set(tz, f);
  }
  return f;
}

export function isValidTimeZone(tz: string): boolean {
  try {
    formatter(tz);
    return true;
  } catch {
    return false;
  }
}

/** The wall-clock time an instant shows in a time zone. */
export function wallClock(utcMs: number, tz: string): WallTime {
  const parts = formatter(tz).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour") % 24, mi: get("minute"), s: get("second") };
}

function asUtc(w: WallTime): number {
  return Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s);
}

/** Offset (local minus UTC) in milliseconds at an instant. */
export function offsetAt(utcMs: number, tz: string): number {
  const ms = utcMs - (((utcMs % 1000) + 1000) % 1000);
  return asUtc(wallClock(ms, tz)) - ms;
}

/**
 * All instants that show a given wall-clock time in a zone: none when the
 * time falls in a spring-forward gap, two when it repeats in the autumn.
 */
export function wallToInstants(w: WallTime, tz: string): number[] {
  const guess = asUtc(w);
  const offsets = new Set([offsetAt(guess - 36 * 3600_000, tz), offsetAt(guess, tz), offsetAt(guess + 36 * 3600_000, tz)]);
  const found: number[] = [];
  for (const off of offsets) {
    const t = guess - off;
    if (asUtc(wallClock(t, tz)) === guess && !found.includes(t)) found.push(t);
  }
  return found.sort((a, b) => a - b);
}

// Some browsers list ICU's old names; people search for the current ones.
const RENAMED: Record<string, string> = {
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Katmandu": "Asia/Kathmandu",
  "Asia/Saigon": "Asia/Ho_Chi_Minh",
  "Asia/Rangoon": "Asia/Yangon",
  "Europe/Kiev": "Europe/Kyiv",
  "America/Godthab": "America/Nuuk",
  "Pacific/Enderbury": "Pacific/Kanton",
  "Atlantic/Faeroe": "Atlantic/Faroe",
  "America/Buenos_Aires": "America/Argentina/Buenos_Aires",
};

export function listTimeZones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  const zones = intl.supportedValuesOf ? intl.supportedValuesOf("timeZone") : [];
  const modern = [...new Set(zones.map((z) => (RENAMED[z] && isValidTimeZone(RENAMED[z]) ? RENAMED[z] : z)))].sort();
  return modern.includes("UTC") ? modern : ["UTC", ...modern];
}
