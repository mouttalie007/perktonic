// Our own date normaliser: ISO validation, the 5-year window, and English relative phrases resolved
// against the reference date. "next Friday" means Friday of next week; "Friday" and "this Friday"
// mean the coming Friday (today if the reference date is a Friday).

const DAY_MS = 86_400_000;
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

export function parseIso(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? d : null;
}

export const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS);

/** Valid ISO date within `years` of the reference date. */
export function withinWindow(date: string | null, reference: string, years: number): boolean {
  const d = parseIso(date);
  const r = parseIso(reference);
  if (!d || !r) return false;
  const lo = new Date(Date.UTC(r.getUTCFullYear() - years, r.getUTCMonth(), r.getUTCDate()));
  const hi = new Date(Date.UTC(r.getUTCFullYear() + years, r.getUTCMonth(), r.getUTCDate()));
  return d >= lo && d <= hi;
}

function nextMonthDay(ref: Date, month: number, day: number): Date | null {
  for (const y of [ref.getUTCFullYear(), ref.getUTCFullYear() + 1]) {
    const d = new Date(Date.UTC(y, month, day));
    if (d.getUTCMonth() !== month) return null;
    if (d >= ref) return d;
  }
  return null;
}

/** Resolve an English due phrase ("tomorrow", "next Friday", "end of the month", "by 4 December"); null when unsure. */
export function resolveDue(text: string | null, reference: string): string | null {
  const ref = parseIso(reference);
  if (!text || !ref) return null;
  const t = text.toLowerCase().replace(/[.,;!]+$/g, "").replace(/\s+/g, " ").trim().replace(/^(by|before|on|at|due|until|no later than)\s+/, "").replace(/^the\s+/, "");
  const isoIn = /\b(\d{4}-\d{2}-\d{2})\b/.exec(t);
  if (isoIn) return parseIso(isoIn[1]) ? isoIn[1] : null;
  if (t === "today" || t === "end of day" || t === "eod" || t === "end of today") return iso(ref);
  if (t === "tomorrow") return iso(addDays(ref, 1));
  const dow = ref.getUTCDay();
  let m = /^(this |next |coming )?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/.exec(t);
  if (m) {
    const target = WEEKDAYS.indexOf(m[2]);
    if (m[1] === "next ") {
      const mondayThisWeek = addDays(ref, -((dow + 6) % 7));
      return iso(addDays(mondayThisWeek, 7 + ((target + 6) % 7)));
    }
    return iso(addDays(ref, (target - dow + 7) % 7));
  }
  if (/^end of (the |this )?month$/.test(t)) return iso(new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 0)));
  if (/^end of next month$/.test(t)) return iso(new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 2, 0)));
  if (/^end of (the |this )?week$/.test(t)) return iso(addDays(ref, (5 - dow + 7) % 7));
  m = /^(?:in|within) (\d{1,3}) (day|days|week|weeks)$/.exec(t);
  if (m) return iso(addDays(ref, Number(m[1]) * (m[2].startsWith("week") ? 7 : 1)));
  m = /^(\d{1,2})(?:st|nd|rd|th)? (?:of )?([a-z]+)(?: (\d{4}))?$/.exec(t) ?? null;
  const m2 = /^([a-z]+) (\d{1,2})(?:st|nd|rd|th)?(?:,? (\d{4}))?$/.exec(t);
  const parts = m ? { day: +m[1], month: m[2], year: m[3] } : m2 ? { day: +m2[2], month: m2[1], year: m2[3] } : null;
  if (parts) {
    const mi = MONTHS.findIndex((x) => x === parts.month || (parts.month.length >= 3 && x.startsWith(parts.month)));
    if (mi < 0) return null;
    if (parts.year) {
      const d = new Date(Date.UTC(+parts.year, mi, parts.day));
      return d.getUTCMonth() === mi ? iso(d) : null;
    }
    const d = nextMonthDay(ref, mi, parts.day);
    return d ? iso(d) : null;
  }
  return null;
}
